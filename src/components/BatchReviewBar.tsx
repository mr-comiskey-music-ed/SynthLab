import React, { useEffect } from 'react';
import { ChevronLeft, ChevronRight, ListChecks, LogOut, Headphones } from 'lucide-react';
import { BatchEntry, doneLabel } from '../utils/batchGrading';

interface BatchReviewBarProps {
  entry: BatchEntry;
  position: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onBackToList: () => void;
  onExit: () => void;
}

/** Floating bar shown while the teacher steps through students' patches on the synth. */
export const BatchReviewBar: React.FC<BatchReviewBarProps> = ({ entry, position, total, onPrev, onNext, onBackToList, onExit }) => {
  // Left/right arrow keys step through students (ignored while typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowLeft' && position > 0) onPrev();
      if (e.key === 'ArrowRight' && position < total - 1) onNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [position, total, onPrev, onNext]);

  const s = entry.submission;
  const pct = s.totalScore;
  const color = pct >= 90 ? 'text-emerald-300 border-emerald-400/50' : pct >= 70 ? 'text-amber-300 border-amber-400/50' : 'text-rose-300 border-rose-400/50';
  const btn = 'p-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 disabled:opacity-30 disabled:cursor-not-allowed';

  return (
    <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[55] max-w-[calc(100vw-32px)]">
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-950/95 border border-emerald-500/50 shadow-2xl backdrop-blur text-xs font-mono text-slate-200">
        <Headphones className="w-4 h-4 text-emerald-400 shrink-0" />
        <span className="text-slate-400 shrink-0">
          {position + 1} of {total}
        </span>
        <span className="font-bold text-white truncate max-w-[160px]">{s.studentName || 'Unnamed student'}</span>
        <span className="text-slate-400 hidden sm:inline shrink-0">
          {doneLabel(s)} tasks
        </span>
        {!entry.patchParams && <span className="text-amber-300 shrink-0">no patch in code</span>}
        <span className={`font-bold px-2 py-0.5 rounded border ${color} shrink-0`}>
          {pct}% {entry.letter}
        </span>
        <button type="button" onClick={onPrev} disabled={position === 0} className={btn} title="Previous student (←)">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button type="button" onClick={onNext} disabled={position >= total - 1} className={btn} title="Next student (→)">
          <ChevronRight className="w-4 h-4" />
        </button>
        <button type="button" onClick={onBackToList} className={`${btn} px-2.5 flex items-center gap-1 font-bold`} title="Back to class list">
          <ListChecks className="w-4 h-4" /> <span className="hidden sm:inline">Class list</span>
        </button>
        <button
          type="button"
          onClick={onExit}
          className="px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold flex items-center gap-1 shrink-0"
          title="Stop reviewing and put your own patch back on the synth"
        >
          <LogOut className="w-3.5 h-3.5" /> Done
        </button>
      </div>
    </div>
  );
};
