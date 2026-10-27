import React from 'react';
import { BriefWork, SynthParams, PhraseId } from '../types';
import { SOUND_BRIEFS } from '../utils/briefs';
import { MY_PRESET_SLOTS } from '../utils/myPresets';
import { adventureInfo } from '../utils/adventures';
import { INITIAL_PRESETS } from '../utils/presets';
import { PHRASES } from '../utils/playback';
import { PatchParamList } from './PatchParamList';
import { Play, Headphones, ChevronDown, Lightbulb, Circle } from 'lucide-react';

interface BriefReviewListProps {
  briefs?: Record<string, BriefWork>;
  /** Brief ids that were assigned; unsaved assigned briefs are listed as not turned in. */
  assigned?: string[];
  onPlay?: (taskId: string, params: SynthParams, phrase?: PhraseId) => void;
  onLoad?: (params: SynthParams) => void;
  /** Show only Sound Design briefs or only My Presets (default: both). */
  only?: 'design' | 'presets';
}

/**
 * Sound Design Briefs in a grade report: hear each one in context, see how many
 * hints were used, and open a dropdown with the settings the student chose.
 */
/** What a saved sound was: the brief it answers, or how a My Preset was made. */
interface Item {
  id: string;
  title: string;
  kind: string;
  context: React.ReactNode;
  phrase: PhraseId;
}

function items(briefs: Record<string, BriefWork>): Item[] {
  const fromBriefs: Item[] = SOUND_BRIEFS.map((b) => ({
    id: b.id,
    title: b.title,
    kind: b.kind,
    phrase: b.phrase,
    context: (
      <>
        <b className="text-slate-300">Brief:</b> {b.ask} <b className="text-slate-300">Listen for:</b> {b.listenFor}
      </>
    ),
  }));
  const fromPresets: Item[] = MY_PRESET_SLOTS.map((s) => {
    const w = briefs[s.id];
    const how =
      s.kind === 'remix'
        ? `Remix of “${INITIAL_PRESETS.find((p) => p.id === w?.base)?.name ?? 'a preset'}” (at least 3 big changes)`
        : s.kind === 'adventure'
        ? `Guided build: ${adventureInfo(w?.base ?? '')?.name ?? 'a sound type'}, from scratch`
        : 'Original, from scratch';
    return {
      id: s.id,
      title: w?.name ? `${s.title}: “${w.name}”` : s.title,
      kind: 'My Preset',
      phrase: w?.phrase ?? adventureInfo(w?.base ?? '')?.phrase ?? 'leadLine',
      context: <><b className="text-slate-300">How it was made:</b> {how}</>,
    };
  });
  return [...fromBriefs, ...fromPresets];
}

export const BriefReviewList: React.FC<BriefReviewListProps> = ({ briefs = {}, assigned, onPlay, onLoad, only }) => {
  const shown = items(briefs)
    .filter((b) => !only || (only === 'presets') === (b.kind === 'My Preset'))
    .filter((b) => briefs[b.id] || assigned?.includes(b.id));
  if (!shown.length) return null;
  return (
    <div className="space-y-1.5">
      {shown.map((b) => {
        const w = briefs[b.id];
        if (!w) {
          return (
            <div key={b.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-900/60 border border-white/5 text-[11px] font-mono text-slate-500">
              <Circle className="w-3.5 h-3.5" /> {b.title} <span className="text-slate-600">({b.kind})</span>
              <span className="ml-auto">not turned in</span>
            </div>
          );
        }
        return (
          <details key={b.id} className="group rounded-lg bg-fuchsia-500/5 border border-fuchsia-500/25">
            <summary className="list-none cursor-pointer px-2.5 py-1.5 flex flex-wrap items-center gap-2 text-[11px] font-mono">
              <ChevronDown className="w-3.5 h-3.5 text-fuchsia-300 group-open:rotate-180 transition-transform shrink-0" />
              <span className="font-bold text-slate-100">{b.title}</span>
              <span className="text-slate-500">{b.kind}</span>
              {w.hints > 0 && (
                <span className="flex items-center gap-0.5 text-yellow-300/90" title="Hints opened">
                  <Lightbulb className="w-3 h-3" /> {w.hints} hint{w.hints > 1 ? 's' : ''}
                </span>
              )}
              <span className="ml-auto flex items-center gap-1">
                {onPlay && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      onPlay(b.id, w.params, b.phrase);
                    }}
                    className="px-2 py-0.5 rounded bg-fuchsia-500 hover:bg-fuchsia-400 text-black font-bold flex items-center gap-1"
                    title={`Play it: ${PHRASES[b.phrase].label}`}
                  >
                    <Play className="w-3 h-3" /> Play
                  </button>
                )}
                {onLoad && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      onLoad(w.params);
                    }}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-white/10 text-slate-200 flex items-center gap-1"
                    title="Load onto the synth to play it yourself"
                  >
                    <Headphones className="w-3 h-3" /> Load
                  </button>
                )}
              </span>
            </summary>
            <div className="px-3 pb-2.5 pt-1 space-y-2 border-t border-fuchsia-500/15">
              <p className="text-[11px] text-slate-400">
                {b.context}
              </p>
              {w.note && <p className="text-[11px] text-fuchsia-100 italic">Student: “{w.note}”</p>}
              <PatchParamList params={w.params} />
            </div>
          </details>
        );
      })}
    </div>
  );
};
