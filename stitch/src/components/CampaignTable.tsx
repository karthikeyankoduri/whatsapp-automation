import { useEffect, useState } from 'react';
import { db } from '../lib/store';
import type { Campaign } from '../lib/store';
import { CheckCircle2, XCircle, Search, Hash, MessageSquare, Clock, ImageIcon } from 'lucide-react';

export default function CampaignTable({ refreshTrigger }: { refreshTrigger: number }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  useEffect(() => {
    setCampaigns(db.getCampaigns());
  }, [refreshTrigger]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden h-full flex flex-col">
      <div className="p-5 border-b border-zinc-200 flex items-center justify-between bg-zinc-50/50">
        <h3 className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
          <Clock size={20} className="text-zinc-400" />
          Recent Campaigns
        </h3>
      </div>

      {campaigns.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-zinc-400">
          <MessageSquare size={48} className="mb-4 text-zinc-200" strokeWidth={1} />
          <p className="text-sm font-medium">No campaigns dispatched yet.</p>
          <p className="text-xs mt-1 text-zinc-400 text-center max-w-xs">Once you dispatch a messaging campaign, it will appear here.</p>
        </div>
      ) : (
        <div className="overflow-x-auto flex-1 h-0">
          <table className="w-full text-left text-sm text-zinc-600">
            <thead className="bg-white sticky top-0 shadow-sm shadow-zinc-100 z-10 text-xs uppercase font-semibold text-zinc-500">
              <tr>
                <th className="px-5 py-4 w-5/12">Message Preview</th>
                <th className="px-5 py-4 w-3/12">Target</th>
                <th className="px-5 py-4 w-2/12">Status</th>
                <th className="px-5 py-4 w-2/12">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {campaigns.map((camp) => (
                <tr key={camp.id} className="hover:bg-zinc-50/80 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center flex-wrap gap-2 mb-1">
                      <div className="text-xs text-zinc-400 font-mono tracking-wider">#{camp.id}</div>
                      {camp.has_image && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-100 text-[10px] font-medium">
                          <ImageIcon size={10} /> Image
                        </span>
                      )}
                    </div>
                    <div className="text-zinc-800 line-clamp-2 text-[13px] leading-relaxed break-words" title={camp.message}>
                      {camp.message}
                    </div>
                  </td>
                  <td className="px-5 py-4 align-top pt-8">
                    {camp.search_query !== undefined ? (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100/50 text-xs font-medium">
                        <Search size={12} />
                        "{camp.search_query || '*'}"
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100/50 text-xs font-medium">
                        <Hash size={12} />
                        Rows: {camp.range_start || 1} - {camp.range_end || 'End'}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-4 align-top pt-8">
                    {camp.status === 'Completed' ? (
                      <div className="flex items-center gap-1.5 text-emerald-600 font-medium text-xs">
                        <CheckCircle2 size={16} /> Completed
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-red-500 font-medium text-xs">
                        <XCircle size={16} /> Failed
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-4 align-top pt-8 text-xs text-zinc-500 whitespace-nowrap font-medium">
                    {new Date(camp.created_at).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
