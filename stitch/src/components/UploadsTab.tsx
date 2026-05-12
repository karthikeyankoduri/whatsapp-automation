import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { UploadCloud, Trash2, FileText, FileSpreadsheet, Eye, X, ChevronLeft, ChevronRight, ShieldCheck } from 'lucide-react';
import { db } from '../lib/store';
import type { UploadBatch, Contact } from '../lib/store';
import { validateFile, validateRowCount, sanitizeCellValue } from '../lib/security';

const PAGE_SIZE = 50;

export default function UploadsTab() {
  const [batches, setBatches] = useState<UploadBatch[]>([]);
  const [isHovering, setIsHovering] = useState(false);

  // Preview modal state
  const [previewBatch, setPreviewBatch] = useState<UploadBatch | null>(null);
  const [previewContacts, setPreviewContacts] = useState<Contact[]>([]);
  const [previewPage, setPreviewPage] = useState(1);

  useEffect(() => {
    loadBatches();
  }, []);

  const loadBatches = () => {
    setBatches(db.getBatches());
  };

  const openPreview = (batch: UploadBatch) => {
    const contacts = db.getContactsByBatch(batch.id);
    setPreviewBatch(batch);
    setPreviewContacts(contacts);
    setPreviewPage(1);
  };

  const closePreview = () => {
    setPreviewBatch(null);
    setPreviewContacts([]);
  };

  // ── shared processing ──────────────────────────────────────────
  const processRows = (
    rows: Record<string, string>[],
    columns: string[],
    fileName: string
  ) => {
    if (!rows.length) {
      toast.error('The file is empty or has no valid rows');
      return;
    }

    // Security: validate row count
    const rowCheck = validateRowCount(rows.length);
    if (!rowCheck.valid) {
      toast.error(rowCheck.error!);
      return;
    }

    // Security: sanitize all cell values to prevent formula injection
    const sanitizedRows = rows.map(row => {
      const cleaned: Record<string, string> = {};
      for (const [key, value] of Object.entries(row)) {
        cleaned[key] = sanitizeCellValue(String(value));
      }
      return cleaned;
    });

    const batch = db.addBatch({ file_name: fileName, contact_count: sanitizedRows.length, columns });

    db.addContacts(
      sanitizedRows.map((row, index) => ({
        batch_id: batch.id,
        name: '',   // will be resolved at campaign-send time via column picker
        phone: '',
        row_number: index + 1,
        raw_data: row
      }))
    );

    toast.success(`Uploaded ${sanitizedRows.length} rows from "${fileName}"`);
    loadBatches();
    openPreview({ ...batch });  // show preview immediately
  };

  // ── CSV ────────────────────────────────────────────────────────
  const handleCsvFile = (file: File) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          toast.error('Error parsing CSV file');
          return;
        }
        const columns = results.meta.fields ?? [];
        processRows(results.data as Record<string, string>[], columns, file.name);
      },
      error: (error: Error) => toast.error(`CSV error: ${error.message}`)
    });
  };

  // ── Excel ──────────────────────────────────────────────────────
  const handleExcelFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target?.result, { type: 'array' });
        const ws = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });
        const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
        processRows(rows, columns, file.name);
      } catch (err: unknown) {
        toast.error(`Excel error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    };
    reader.onerror = () => toast.error('Failed to read the file');
    reader.readAsArrayBuffer(file);
  };

  const handleFileUpload = (file: File) => {
    // Security: validate file type, MIME, and size before processing
    const fileCheck = validateFile(file);
    if (!fileCheck.valid) {
      toast.error(fileCheck.error!);
      return;
    }

    const name = file.name.toLowerCase();
    if (name.endsWith('.csv')) handleCsvFile(file);
    else if (name.endsWith('.xlsx') || name.endsWith('.xls')) handleExcelFile(file);
    else toast.error('Only .csv, .xlsx, or .xls files are supported');
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsHovering(false);
    if (e.dataTransfer.files?.[0]) handleFileUpload(e.dataTransfer.files[0]);
  };

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      handleFileUpload(e.target.files[0]);
      e.target.value = '';
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Delete this batch and all its contacts?')) {
      db.deleteBatch(id);
      toast.success('Batch deleted');
      if (previewBatch?.id === id) closePreview();
      loadBatches();
    }
  };

  const getFileIcon = (fileName: string) => {
    const l = fileName.toLowerCase();
    return l.endsWith('.xlsx') || l.endsWith('.xls')
      ? <FileSpreadsheet size={18} className="text-emerald-500" />
      : <FileText size={18} className="text-indigo-400" />;
  };

  // ── preview pagination ─────────────────────────────────────────
  const totalPages = previewBatch ? Math.ceil(previewContacts.length / PAGE_SIZE) : 1;
  const pagedContacts = previewContacts.slice((previewPage - 1) * PAGE_SIZE, previewPage * PAGE_SIZE);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* ── Upload Zone ─────────────────────────────────────────── */}
      <div
        className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center transition-all bg-white cursor-pointer ${
          isHovering ? 'border-indigo-500 bg-indigo-50/50' : 'border-zinc-300 hover:border-indigo-400 hover:bg-zinc-50'
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsHovering(true); }}
        onDragLeave={() => setIsHovering(false)}
        onDrop={onDrop}
        onClick={() => document.getElementById('file-upload')?.click()}
      >
        <div className="bg-indigo-100 p-4 rounded-full text-indigo-600 mb-3">
          <UploadCloud size={32} />
        </div>
        <h3 className="text-xl font-semibold text-zinc-900 mb-1">Upload your Contacts</h3>
        <p className="text-sm text-zinc-500 text-center max-w-sm mb-2">
          Drag & drop or click to browse. Any column layout is accepted — you'll map columns inside the Campaigns tab.
        </p>
        <div className="flex items-center gap-1.5 text-xs text-emerald-600 mb-3">
          <ShieldCheck size={14} />
          <span>Files are validated for type, size (≤ 10 MB), and content safety</span>
        </div>
        <div className="flex gap-2 mb-4">
          <span className="flex items-center gap-1 text-xs bg-zinc-100 border border-zinc-200 px-3 py-1 rounded-full text-zinc-500">
            <FileText size={13} className="text-indigo-400" /> CSV
          </span>
          <span className="flex items-center gap-1 text-xs bg-zinc-100 border border-zinc-200 px-3 py-1 rounded-full text-zinc-500">
            <FileSpreadsheet size={13} className="text-emerald-500" /> Excel (.xlsx / .xls)
          </span>
        </div>
        <button className="bg-white border shadow-sm border-zinc-200 px-4 py-2 rounded-lg text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors">
          Select File
        </button>
        <input id="file-upload" type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={onFileInput} />
      </div>

      {/* ── Batch History ────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden">
        <div className="p-5 border-b border-zinc-100">
          <h3 className="text-lg font-semibold text-zinc-900">Upload History</h3>
        </div>
        {batches.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center text-zinc-400">
            <FileText size={48} className="mb-4 text-zinc-200" />
            <p>No batches uploaded yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-600">
              <thead className="bg-zinc-50/80 text-zinc-500 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-6 py-4">File</th>
                  <th className="px-6 py-4">Columns</th>
                  <th className="px-6 py-4">Rows</th>
                  <th className="px-6 py-4">Uploaded</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {batches.map(batch => (
                  <tr key={batch.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 font-medium text-zinc-900">
                        {getFileIcon(batch.file_name)}
                        {batch.file_name}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {(batch.columns ?? []).map(col => (
                          <span key={col} className="text-[11px] bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-full">
                            {col}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-zinc-100 text-zinc-700 py-1 px-2.5 rounded-full text-xs font-medium border border-zinc-200">
                        {batch.contact_count} rows
                      </span>
                    </td>
                    <td className="px-6 py-4 text-zinc-500 whitespace-nowrap">
                      {new Date(batch.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openPreview(batch)}
                          className="text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 p-2 rounded-md transition-colors"
                          title="Preview file"
                        >
                          <Eye size={17} />
                        </button>
                        <button
                          onClick={() => handleDelete(batch.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-md transition-colors"
                          title="Delete batch"
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Preview Modal ────────────────────────────────────────── */}
      {previewBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-6xl max-h-[90vh]">

            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 shrink-0">
              <div className="flex items-center gap-3">
                {getFileIcon(previewBatch.file_name)}
                <div>
                  <h2 className="font-semibold text-zinc-900">{previewBatch.file_name}</h2>
                  <p className="text-xs text-zinc-500">
                    {previewBatch.contact_count} rows · {(previewBatch.columns ?? []).length} columns
                  </p>
                </div>
              </div>
              <button onClick={closePreview} className="p-2 rounded-lg hover:bg-zinc-100 text-zinc-500 transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Table */}
            <div className="overflow-auto flex-1">
              <table className="min-w-full text-sm text-left text-zinc-700 border-collapse">
                <thead className="bg-zinc-50 sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold text-zinc-400 uppercase w-12">#</th>
                    {(previewBatch.columns ?? []).map(col => (
                      <th key={col} className="px-4 py-3 text-xs font-semibold text-zinc-600 uppercase whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {pagedContacts.map(contact => (
                    <tr key={contact.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="px-4 py-2.5 text-zinc-400 text-xs">{contact.row_number}</td>
                      {(previewBatch.columns ?? []).map(col => (
                        <td key={col} className="px-4 py-2.5 text-zinc-700 max-w-[220px] truncate">
                          {contact.raw_data?.[col] ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-3 border-t border-zinc-100 bg-zinc-50/50 rounded-b-2xl shrink-0">
                <p className="text-xs text-zinc-500">
                  Rows {(previewPage - 1) * PAGE_SIZE + 1}–{Math.min(previewPage * PAGE_SIZE, previewContacts.length)} of {previewContacts.length}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPreviewPage(p => Math.max(1, p - 1))}
                    disabled={previewPage === 1}
                    className="p-1.5 rounded-md border border-zinc-200 disabled:opacity-40 hover:bg-zinc-100 transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-xs text-zinc-600 font-medium">
                    Page {previewPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPreviewPage(p => Math.min(totalPages, p + 1))}
                    disabled={previewPage === totalPages}
                    className="p-1.5 rounded-md border border-zinc-200 disabled:opacity-40 hover:bg-zinc-100 transition-colors"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
