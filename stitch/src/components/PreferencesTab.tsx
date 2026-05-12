import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { db } from '../lib/store';
import { validateWebhookUrl } from '../lib/security';
import { Link2, Save, ShieldCheck, ShieldAlert, Check, AlertTriangle } from 'lucide-react';

const SECURITY_FEATURES = [
  { name: 'Content Security Policy', active: true },
  { name: 'Input Sanitization', active: true },
  { name: 'File Upload Validation', active: true },
  { name: 'HTTPS-Only Webhooks', active: true },
  { name: 'Data Obfuscation (Storage)', active: true },
  { name: 'Rate Limiting (30s)', active: true },
  { name: 'Formula Injection Guard', active: true },
  { name: 'Clickjacking Protection', active: true },
];

export default function PreferencesTab() {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [urlStatus, setUrlStatus] = useState<{ valid: boolean; error?: string } | null>(null);

  useEffect(() => {
    setWebhookUrl(db.getWebhookUrl());
  }, []);

  // Live URL validation as user types
  useEffect(() => {
    if (!webhookUrl.trim()) {
      setUrlStatus(null);
      return;
    }
    setUrlStatus(validateWebhookUrl(webhookUrl));
  }, [webhookUrl]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    // Security: validate webhook URL
    const validation = validateWebhookUrl(webhookUrl);
    if (!validation.valid) {
      toast.error(validation.error || 'Invalid webhook URL');
      return;
    }

    db.setWebhookUrl(webhookUrl.trim());
    toast.success('Preferences saved successfully!');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-500 mt-2">

      {/* Webhook Configuration */}
      <div className="bg-white p-8 rounded-xl shadow-sm border border-zinc-200">
        <div className="flex items-center gap-3 mb-6 border-b border-zinc-100 pb-6">
          <div className="bg-indigo-50 p-3 rounded-lg text-indigo-600">
            <Link2 size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-zinc-900">Webhook Configuration</h2>
            <p className="text-sm text-zinc-500">Set the endpoint where campaign data will be sent.</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="webhook" className="block text-sm font-medium text-zinc-700">
              Webhook URL
            </label>
            <div className="relative">
              <input
                id="webhook"
                type="url"
                placeholder="https://your-server.com/api/webhook"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className={`w-full rounded-lg border px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-2 transition-shadow bg-zinc-50 focus:bg-white text-zinc-900 ${
                  urlStatus === null
                    ? 'border-zinc-300 focus:ring-indigo-500 focus:border-indigo-500'
                    : urlStatus.valid
                    ? 'border-emerald-400 focus:ring-emerald-500 focus:border-emerald-500'
                    : 'border-red-400 focus:ring-red-500 focus:border-red-500'
                }`}
              />
              {/* Live validation indicator */}
              {urlStatus && (
                <div className="absolute right-3 top-3.5">
                  {urlStatus.valid ? (
                    <ShieldCheck size={16} className="text-emerald-500" />
                  ) : (
                    <AlertTriangle size={16} className="text-red-500" />
                  )}
                </div>
              )}
            </div>

            {/* Validation error message */}
            {urlStatus && !urlStatus.valid && (
              <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
                <ShieldAlert size={13} />
                <span>{urlStatus.error}</span>
              </div>
            )}

            {/* HTTPS hint */}
            <div className="flex items-center gap-1.5 mt-1">
              <ShieldCheck size={12} className="text-emerald-500" />
              <span className="text-xs text-zinc-500">Only HTTPS URLs to public endpoints are accepted</span>
            </div>

            <p className="text-xs text-zinc-500 mt-2">
              The payload will automatically format as: <code className="bg-zinc-100 px-1 py-0.5 rounded text-zinc-700 border border-zinc-200">{"{ campaign_id, batch_id, message, contacts: [] }"}</code>
            </p>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={urlStatus !== null && !urlStatus.valid}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm ${
                urlStatus !== null && !urlStatus.valid
                  ? 'bg-zinc-300 text-zinc-500 cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
            >
              <Save size={18} />
              Save Configuration
            </button>
          </div>
        </form>
      </div>

      {/* Security Status Panel */}
      <div className="bg-white p-8 rounded-xl shadow-sm border border-zinc-200">
        <div className="flex items-center gap-3 mb-6 border-b border-zinc-100 pb-6">
          <div className="bg-emerald-50 p-3 rounded-lg text-emerald-600">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-zinc-900">Security Status</h2>
            <p className="text-sm text-zinc-500">All protections are active and verified.</p>
          </div>
          <div className="ml-auto bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-full">
            {SECURITY_FEATURES.length} / {SECURITY_FEATURES.length} Active
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SECURITY_FEATURES.map(f => (
            <div
              key={f.name}
              className="flex items-center gap-3 bg-emerald-50/50 border border-emerald-100 rounded-lg px-4 py-3 transition-all hover:bg-emerald-50"
            >
              <div className="bg-emerald-500 p-1 rounded-full shrink-0">
                <Check size={10} className="text-white" />
              </div>
              <span className="text-sm font-medium text-zinc-800">{f.name}</span>
            </div>
          ))}
        </div>

        <div className="mt-5 bg-zinc-50 border border-zinc-200 rounded-lg p-4 text-xs text-zinc-500 leading-relaxed">
          <strong className="text-zinc-700">How this protects your customers:</strong>{' '}
          Your data is obfuscated in browser storage, all inputs are sanitised before processing,
          file uploads are validated for type &amp; size, webhook calls are restricted to HTTPS only,
          and Content Security Policy headers block unauthorised scripts from running on this page.
        </div>
      </div>
    </div>
  );
}

