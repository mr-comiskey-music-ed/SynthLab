import React, { useEffect, useState } from 'react';
import { Check, AlertTriangle } from 'lucide-react';

export type SaveStatus = 'idle' | 'saved' | 'failed';

/**
 * Small pop-up beside the Grade Report tab: appears for a few seconds after each save so students
 * can see their work is being kept. The "Not saving" warning stays up until it's resolved.
 */
export const SaveIndicator: React.FC<{ status: SaveStatus; savedAt: number | null }> = ({ status, savedAt }) => {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (status !== 'saved' || !savedAt) return;
    setShow(true);
    const timer = window.setTimeout(() => setShow(false), 4000);
    return () => window.clearTimeout(timer);
  }, [status, savedAt]);

  if (status === 'failed') {
    return (
      <div
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono border whitespace-nowrap bg-slate-900 text-amber-300 border-amber-500/40"
        title="This browser is blocking saving. Your work will be lost if you close this tab. Make a code in the Grade Report to keep it."
      >
        <AlertTriangle className="w-3 h-3" />
        <span>Not saving</span>
      </div>
    );
  }
  if (status !== 'saved' || !show) return null;
  const time = savedAt ? new Date(savedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
  return (
    <div
      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono whitespace-nowrap bg-slate-900 text-slate-300 border border-white/10"
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
