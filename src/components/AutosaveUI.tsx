import React from 'react';
import { Check, AlertTriangle } from 'lucide-react';

export type SaveStatus = 'idle' | 'saved' | 'failed';

/** Small status label for the header: lets students see their work is being kept. */
export const SaveIndicator: React.FC<{ status: SaveStatus; savedAt: number | null }> = ({ status, savedAt }) => {
  if (status === 'idle') return null;
  if (status === 'failed') {
    return (
      <div
        className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono border bg-amber-500/20 text-amber-300 border-amber-500/40"
        title="This browser is blocking saving. Your work will be lost if you close this tab. Make a code in the Grade Report to keep it."
      >
        <AlertTriangle className="w-3 h-3" />
        <span>Not saving</span>
      </div>
    );
  }
  const time = savedAt ? new Date(savedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
  return (
    <div
      className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono text-slate-400"
      title="Your work is saved in this browser on this computer. You still turn in your code."
    >
      <Check className="w-3 h-3" />
      <span>Saved{time ? ` ${time}` : ''}</span>
    </div>
  );
};

/** Shown on load when this browser has saved work from an earlier visit. */
export const RestorePrompt: React.FC<{ savedAt: number; onRestore: () => void; onStartFresh: () => void }> = ({
  savedAt,
  onRestore,
  onStartFresh,
}) => {
  const when = new Date(savedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-xl border border-white/15 bg-slate-900 p-5 shadow-xl">
        <h2 className="font-mono text-base font-bold text-white">Restore your last session?</h2>
        <p className="mt-2 text-sm text-slate-300">
          Your work from {when} is saved in this browser. Restore it to pick up where you left off, or start over.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onRestore}
            className="flex-1 rounded-lg bg-amber-500 px-3 py-2 font-mono text-sm font-bold text-black hover:bg-amber-400"
          >
            Restore
          </button>
          <button
            type="button"
            onClick={onStartFresh}
            className="flex-1 rounded-lg border border-white/20 bg-slate-800 px-3 py-2 font-mono text-sm text-slate-200 hover:bg-slate-700"
          >
            Start Fresh
          </button>
        </div>
      </div>
    </div>
  );
};
