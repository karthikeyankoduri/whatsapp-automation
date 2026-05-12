import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Send, Search, Users, ChevronDown, ShieldAlert, ImageIcon, X, Paperclip } from 'lucide-react';
import { db } from '../lib/store';
import type { UploadBatch } from '../lib/store';
import { sanitizeInput, isRateLimited, markAction, validateImageFile } from '../lib/security';

type Mode = 'range' | 'search';

export default function CampaignForm({ onCreated }: { onCreated: () => void }) {
  const [batches, setBatches] = useState<UploadBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');

  const [nameCol, setNameCol] = useState('');
  const [phoneCol, setPhoneCol] = useState('');

  const [message, setMessage] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>('range');

  const [startRange, setStartRange] = useState<number | ''>('');
  const [endRange, setEndRange] = useState<number | ''>('');
  const [searchQuery, setSearchQuery] = useState('');

  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    setBatches(db.getBatches());
  }, []);

  const handleImageSelect = useCallback((file: File) => {
    const result = validateImageFile(file);
    if (!result.valid) { toast.error(result.error!); return; }
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  }, [imagePreviewUrl]);

  const clearImage = useCallback(() => {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImageFile(null);
    setImagePreviewUrl(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
  }, [imagePreviewUrl]);

  // When batch changes, auto-guess the name/phone columns
  const selectedBatch = useMemo(() => batches.find(b => b.id === selectedBatchId), [batches, selectedBatchId]);

  useEffect(() => {
    if (!selectedBatch) { setNameCol(''); setPhoneCol(''); return; }
    const cols = selectedBatch.columns ?? [];
    const guessName = cols.find(c => /name/i.test(c)) ?? cols[0] ?? '';
    const guessPhone = cols.find(c => /phone|mobile|number|tel/i.test(c)) ?? cols[1] ?? cols[0] ?? '';
    setNameCol(guessName);
    setPhoneCol(guessPhone);
  }, [selectedBatchId, selectedBatch]);

  const contacts = useMemo(() => {
    if (!selectedBatchId) return [];
    return db.getContactsByBatch(selectedBatchId);
  }, [selectedBatchId]);

  // Build display-ready contacts using selected columns
  const mappedContacts = useMemo(() =>
    contacts.map(c => ({
      ...c,
      displayName: nameCol ? (c.raw_data?.[nameCol] ?? '') : c.name,
      displayPhone: phoneCol ? (c.raw_data?.[phoneCol] ?? '') : c.phone,
    })),
    [contacts, nameCol, phoneCol]);

  const filteredContacts = useMemo(() => {
    if (!selectedBatchId || mappedContacts.length === 0) return [];

    if (mode === 'range') {
      const start = typeof startRange === 'number' ? startRange : 1;
      const end = typeof endRange === 'number' ? endRange : mappedContacts.length;
      return mappedContacts.filter(c => c.row_number >= start && c.row_number <= end);
    } else {
      if (!searchQuery.trim()) return mappedContacts;
      const lq = searchQuery.toLowerCase();
      return mappedContacts.filter(
        c => c.displayName.toLowerCase().includes(lq) ||
          c.displayPhone.toLowerCase().includes(lq) ||
          c.row_number.toString() === lq
      );
    }
  }, [selectedBatchId, mappedContacts, mode, startRange, endRange, searchQuery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedBatchId) return toast.error('Please select an upload batch.');
    if (!nameCol || !phoneCol) return toast.error('Please select Name and Phone columns.');
    if (!message.trim()) return toast.error('Message cannot be empty.');
    if (filteredContacts.length === 0) return toast.error('No recipients match the current filter.');

    const webhookUrl = db.getWebhookUrl();
    if (!webhookUrl) return toast.error('Webhook URL not configured. Set it in Preferences.');

    // Security: rate-limit check (30s cooldown)
    const rateCheck = isRateLimited('campaign_dispatch');
    if (rateCheck.limited) {
      return toast.error(
        `Please wait ${rateCheck.remainingSeconds}s before dispatching another campaign.`,
        { icon: '⏱️' }
      );
    }

    // Security: confirmation dialog
    const confirmed = window.confirm(
      `You are about to send messages to ${filteredContacts.length} contact(s). This action cannot be undone.\n\nProceed?`
    );
    if (!confirmed) return;

    setIsSending(true);
    markAction('campaign_dispatch');
    const campaignId = Math.random().toString(36).substring(2, 9);

    // Security: sanitize user-provided text before sending to webhook
    const sanitizedMessage = sanitizeInput(message);
    const sanitizedSearch = sanitizeInput(searchQuery);

    const recipientsArray = filteredContacts.map(c => ({
      row_number: c.row_number,
      name: c.displayName,
      phone: c.displayPhone,
      personalized_message: sanitizedMessage.replace(/\{\{name\}\}/gi, c.displayName),
    }));

    const formData = new FormData();

    // ── Campaign ID ───────────────────────────────────────────────────────────
    formData.append('campaign_id', campaignId);

    // ── Message template ─────────────────────────────────────────────────────
    formData.append('message', sanitizedMessage);

    // ── Recipients — table structure (one object per row) ────────────────────
    //    Each entry: { row_number, name, phone, message }
    const recipientsTable = recipientsArray.map(r => ({
      row_number: r.row_number,
      name:       r.name,
      phone:      r.phone,
      message:    r.personalized_message,
    }));
    formData.append('recipients', JSON.stringify(recipientsTable));

    // ── Image binary — always appended LAST ───────────────────────────────────
    if (imageFile) formData.append('image', imageFile, imageFile.name);

    try {
      // No Content-Type header — browser sets multipart/form-data with boundary automatically
      const response = await fetch(webhookUrl, { method: 'POST', body: formData });

      if (!response.ok) throw new Error(`Server returned ${response.status}`);

      db.addCampaign({
        id: campaignId,
        batch_id: selectedBatchId,
        message: sanitizedMessage,
        has_image: !!imageFile,
        name_column: nameCol,
        phone_column: phoneCol,
        range_start: mode === 'range' && typeof startRange === 'number' ? startRange : undefined,
        range_end: mode === 'range' && typeof endRange === 'number' ? endRange : undefined,
        search_query: mode === 'search' ? sanitizedSearch : undefined,
        status: 'Completed',
      });

      toast.success(`Campaign sent to ${filteredContacts.length} contacts!`);
      setMessage(''); setStartRange(''); setEndRange(''); setSearchQuery(''); clearImage();
      onCreated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Webhook failed: ${msg}`);

      db.addCampaign({
        id: campaignId,
        batch_id: selectedBatchId,
        message: sanitizedMessage,
        has_image: !!imageFile,
        name_column: nameCol,
        phone_column: phoneCol,
        range_start: mode === 'range' && typeof startRange === 'number' ? startRange : undefined,
        range_end: mode === 'range' && typeof endRange === 'number' ? endRange : undefined,
        search_query: mode === 'search' ? sanitizedSearch : undefined,
        status: 'Failed',
      });
      onCreated();
    } finally {
      setIsSending(false);
    }
  };

  const cols = selectedBatch?.columns ?? [];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-zinc-200 p-6">
      <form onSubmit={handleSubmit} className="space-y-5">

        {/* 1. Batch */}
        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-zinc-800">1. Select Upload File</label>
          <div className="relative">
            <select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              className="w-full appearance-none rounded-lg border border-zinc-300 px-4 py-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-zinc-50 text-zinc-800"
            >
              <option value="">— Choose a CSV / Excel upload —</option>
              {batches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.file_name} ({b.contact_count} rows)
                </option>
              ))}
            </select>
            <ChevronDown size={15} className="absolute right-3 top-3.5 text-zinc-400 pointer-events-none" />
          </div>
        </div>

        {/* 2. Column Mapping — shown only when a batch is selected */}
        {selectedBatchId && cols.length > 0 && (
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-zinc-800">2. Map Columns</label>
            <div className="grid grid-cols-2 gap-3 bg-indigo-50/60 border border-indigo-100 rounded-xl p-4">
              <div className="space-y-1">
                <label className="text-xs text-indigo-700 font-medium">Name column</label>
                <div className="relative">
                  <select
                    value={nameCol}
                    onChange={e => setNameCol(e.target.value)}
                    className="w-full appearance-none rounded-md border border-indigo-200 px-3 py-2 pr-8 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-800"
                  >
                    <option value="">— pick column —</option>
                    {cols.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <ChevronDown size={13} className="absolute right-2.5 top-2.5 text-zinc-400 pointer-events-none" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-indigo-700 font-medium">Phone column</label>
                <div className="relative">
                  <select
                    value={phoneCol}
                    onChange={e => setPhoneCol(e.target.value)}
                    className="w-full appearance-none rounded-md border border-indigo-200 px-3 py-2 pr-8 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-800"
                  >
                    <option value="">— pick column —</option>
                    {cols.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <ChevronDown size={13} className="absolute right-2.5 top-2.5 text-zinc-400 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. Message + Image */}
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-zinc-800">3. Message Content</label>

          {/* Message textarea */}
          <div className="relative">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Hi {{name}}, we have a special offer for you!"
              rows={4}
              className="w-full rounded-lg border border-zinc-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-zinc-50 resize-none text-zinc-800"
            />
            <p className="text-xs text-zinc-400 absolute bottom-2.5 right-3 select-none pointer-events-none bg-zinc-50/90 px-1.5 py-0.5 rounded">
              Use <code className="text-indigo-600 bg-indigo-50 px-1 rounded font-mono">{"{{name}}"}</code> to personalize
            </p>
          </div>

          {/* Image Upload */}
          <div className="space-y-2">
            <p className="text-xs text-zinc-500 font-medium flex items-center gap-1">
              <Paperclip size={12} /> Attach Image <span className="font-normal text-zinc-400">(optional · JPG, PNG, WEBP, GIF · max 5 MB)</span>
            </p>

            {imageFile && imagePreviewUrl ? (
              /* Preview card */
              <div className="flex items-center gap-3 p-3 rounded-xl border border-indigo-200 bg-indigo-50/40">
                <img
                  src={imagePreviewUrl}
                  alt="preview"
                  className="w-14 h-14 rounded-lg object-cover border border-indigo-100 flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-800 truncate">{imageFile.name}</p>
                  <p className="text-xs text-zinc-400">{(imageFile.size / 1024).toFixed(1)} KB</p>
                </div>
                <button
                  type="button"
                  onClick={clearImage}
                  className="flex-shrink-0 p-1.5 rounded-full hover:bg-red-50 text-zinc-400 hover:text-red-500 transition-colors"
                  aria-label="Remove image"
                >
                  <X size={15} />
                </button>
              </div>
            ) : (
              /* Drop zone */
              <div
                onClick={() => imageInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={e => {
                  e.preventDefault(); setIsDragOver(false);
                  const file = e.dataTransfer.files[0];
                  if (file) handleImageSelect(file);
                }}
                className={`flex flex-col items-center justify-center gap-2 p-5 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
                  isDragOver
                    ? 'border-indigo-400 bg-indigo-50'
                    : 'border-zinc-300 bg-zinc-50 hover:border-indigo-300 hover:bg-indigo-50/30'
                }`}
              >
                <ImageIcon size={22} className={isDragOver ? 'text-indigo-500' : 'text-zinc-300'} />
                <p className="text-xs text-zinc-400 text-center">
                  <span className="font-semibold text-indigo-600">Click to browse</span> or drag &amp; drop an image here
                </p>
              </div>
            )}

            {/* Hidden file input */}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleImageSelect(f); }}
            />
          </div>
        </div>

        {/* 4. Recipients */}
        <div className="space-y-3 pt-1 border-t border-zinc-100">
          <div className="flex justify-between items-center">
            <label className="block text-sm font-semibold text-zinc-800">4. Select Recipients</label>
            <div className="flex bg-zinc-100 p-1 rounded-lg">
              {(['range', 'search'] as Mode[]).map(m => (
                <button
                  key={m} type="button" onClick={() => setMode(m)}
                  className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${mode === m ? 'bg-white text-indigo-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                    }`}
                >
                  {m === 'range' ? 'By Range' : 'By Search'}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200">
            {mode === 'range' ? (
              <div className="flex gap-4">
                <div className="flex-1 space-y-1">
                  <label className="text-xs text-zinc-500">Start Row</label>
                  <input type="number" min={1} value={startRange}
                    onChange={e => setStartRange(e.target.value ? Number(e.target.value) : '')}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g. 1" />
                </div>
                <div className="flex-1 space-y-1">
                  <label className="text-xs text-zinc-500">End Row</label>
                  <input type="number" min={1} value={endRange}
                    onChange={e => setEndRange(e.target.value ? Number(e.target.value) : '')}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder={`e.g. ${contacts.length || 100}`} />
                </div>
              </div>
            ) : (
              <div className="relative">
                <Search size={15} className="absolute left-3 top-3 text-zinc-400" />
                <input type="text" value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Search by name, phone, or exact row number…" />
              </div>
            )}
          </div>

          {/* Live Preview */}
          {selectedBatchId && (
            <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold text-indigo-800 uppercase flex items-center gap-1.5">
                  <Users size={13} /> Live Preview
                </h4>
                <div className="bg-white px-2 py-1 rounded text-xs font-semibold text-indigo-700 shadow-sm border border-indigo-100">
                  {filteredContacts.length} / {contacts.length} selected
                </div>
              </div>

              {filteredContacts.length > 0 ? (
                <div className="overflow-hidden rounded-md border border-indigo-100/60 bg-white">
                  <table className="min-w-full divide-y divide-zinc-100 text-xs">
                    <thead className="bg-zinc-50/60">
                      <tr>
                        <th className="px-3 py-2 text-left text-zinc-500 font-semibold uppercase">Row</th>
                        <th className="px-3 py-2 text-left text-zinc-500 font-semibold uppercase">
                          {nameCol || 'Name'}
                        </th>
                        <th className="px-3 py-2 text-left text-zinc-500 font-semibold uppercase">
                          {phoneCol || 'Phone'}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {filteredContacts.slice(0, 5).map(c => (
                        <tr key={c.id}>
                          <td className="px-3 py-2 text-zinc-400">{c.row_number}</td>
                          <td className="px-3 py-2 font-medium text-zinc-800 max-w-[120px] truncate">{c.displayName}</td>
                          <td className="px-3 py-2 text-zinc-600">{c.displayPhone}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredContacts.length > 5 && (
                    <div className="text-center py-2 bg-zinc-50/50 border-t border-zinc-100 text-[11px] text-zinc-400 italic">
                      + {filteredContacts.length - 5} more
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-center py-3 text-sm text-zinc-400">No contacts match.</p>
              )}
            </div>
          )}
        </div>

        {/* Rate-limit & Security hint */}
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 -mt-1">
          <ShieldAlert size={12} />
          <span>30s cooldown between sends · inputs are sanitized before dispatch</span>
        </div>

        {/* Submit */}
        <button
          type="submit" disabled={isSending}
          className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold transition-all shadow-md ${isSending
              ? 'bg-indigo-400 text-white cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-lg hover:-translate-y-0.5'
            }`}
        >
          {isSending ? (
            <><div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> Sending…</>
          ) : (
            <><Send size={17} /> Dispatch Messages</>
          )}
        </button>
      </form>
    </div>
  );
}
