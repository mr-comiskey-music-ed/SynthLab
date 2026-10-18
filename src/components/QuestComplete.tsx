import React from 'react';
import { PartyPopper, Sparkles, FileText } from 'lucide-react';

interface QuestCompleteProps {
  /** e.g. "Synth Doctor" */
  quest: string;
  /** One line about how it went, e.g. "10 of 10 fixed". */
  summary?: string;
  tone?: 'emerald' | 'cyan' | 'amber' | 'fuchsia' | 'violet';
  onGoToPlayground?: () => void;
  onGoToReport?: () => void;
}

const TONES: Record<NonNullable<QuestCompleteProps['tone']>, string> = {
  emerald: 'bg-emerald-950/50 border-emerald-400/50 text-emerald-100',
  cyan: 'bg-cyan-950/50 border-cyan-400/50 text-cyan-100',
  amber: 'bg-amber-950/40 border-amber-400/50 text-amber-100',
  fuchsia: 'bg-fuchsia-950/40 border-fuchsia-400/50 text-fuchsia-100',
  violet: 'bg-violet-950/40 border-violet-400/50 text-violet-100',
};

/** The send-off shown when a student finishes the last piece of a quest. */
export const QuestComplete: React.FC<QuestCompleteProps> = ({ quest, summary, tone = 'emerald', onGoToPlayground, onGoToReport }) => (
  <div className={`mt-3 p-4 rounded-xl border space-y-2 ${TONES[tone]}`} data-testid="quest-complete">
    <div className="flex items-center gap-2 font-bold text-base">
      <PartyPopper className="w-5 h-5" /> Congratulations! You finished {quest}.
    </div>
    {summary && <p className="text-xs opacity-90">{summary}</p>}
    <p className="text-xs opacity-90">
      Keep experimenting in the Playground, or open the Grade Report to get the code to turn in. Your teacher may have assigned other quests too, so
      check the list.
    </p>
    <div className="flex flex-wrap gap-2">
      {onGoToPlayground && (
        <button
          type="button"
          onClick={onGoToPlayground}
          className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 border border-white/20 font-mono font-bold text-xs flex items-center gap-1.5"
        >
          <Sparkles className="w-3.5 h-3.5" /> Go to the Playground
        </button>
      )}
      {onGoToReport && (
        <button
          type="button"
          onClick={onGoToReport}
          className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 border border-white/20 font-mono font-bold text-xs flex items-center gap-1.5"
        >
          <FileText className="w-3.5 h-3.5" /> Open the Grade Report
        </button>
      )}
    </div>
  </div>
);
