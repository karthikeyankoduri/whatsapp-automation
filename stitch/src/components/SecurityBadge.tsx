import { useState } from 'react';
import { ShieldCheck, ChevronDown, ChevronUp, Check } from 'lucide-react';

const PROTECTIONS = [
  { label: 'Content Security Policy (CSP)', description: 'Blocks unauthorized scripts from running' },
  { label: 'Input Sanitization', description: 'Strips malicious code from all text inputs' },
  { label: 'File Upload Validation', description: 'Checks type, size, and content of uploaded files' },
  { label: 'Webhook HTTPS-Only', description: 'Only secure HTTPS endpoints are allowed' },
  { label: 'Data Obfuscation', description: 'Stored data is encoded, not plain text' },
  { label: 'Rate Limiting', description: '30s cooldown prevents accidental spam' },
  { label: 'Formula Injection Guard', description: 'Neutralizes dangerous spreadsheet formulas' },
  { label: 'Clickjacking Protection', description: 'Prevents embedding in malicious iframes' },
];

export default function SecurityBadge() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/60 transition-all duration-200 group"
      >
        <div className="bg-emerald-500 p-1 rounded-md shadow-sm">
          <ShieldCheck size={12} className="text-white" />
        </div>
        <span className="flex-1 text-left">Secured &amp; Protected</span>
        {isOpen ? (
          <ChevronDown size={13} className="text-emerald-400 transition-transform" />
        ) : (
          <ChevronUp size={13} className="text-emerald-400 transition-transform" />
        )}
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-zinc-200 rounded-xl shadow-xl p-4 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <h4 className="text-xs font-bold text-zinc-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <ShieldCheck size={13} className="text-emerald-500" />
            Active Protections
          </h4>
          <ul className="space-y-2">
            {PROTECTIONS.map(p => (
              <li key={p.label} className="flex items-start gap-2">
                <div className="mt-0.5 bg-emerald-100 p-0.5 rounded-full shrink-0">
                  <Check size={10} className="text-emerald-600" />
                </div>
                <div>
                  <span className="text-xs font-medium text-zinc-800">{p.label}</span>
                  <p className="text-[10px] text-zinc-400 leading-tight">{p.description}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3 pt-2 border-t border-zinc-100">
            <p className="text-[10px] text-zinc-400 text-center">8 / 8 protections active</p>
          </div>
        </div>
      )}
    </div>
  );
}
