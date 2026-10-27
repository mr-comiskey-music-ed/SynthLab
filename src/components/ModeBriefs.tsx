import React, { useEffect, useState } from 'react';
import { SynthParams, BriefWork, SoundBrief } from '../types';
import { SubtractiveEngine } from '../audio/synthEngine';
import { SOUND_BRIEFS, changedSettingsCount, MIN_CHANGES_TO_SAVE, BRIEF_NOTE_MAX, BRIEFS_TO_FINISH, briefTips } from '../utils/briefs';
import { QuestComplete } from './QuestComplete';
import { DEFAULT_SYNTH_PARAMS } from '../utils/presets';
import { stopPhrase } from '../utils/playback';
import { PhraseButtons } from './PhraseButtons';
import { PatchParamList } from './PatchParamList';
import { Lightbulb, Save, CheckCircle, RotateCcw, Music, Sparkles, Upload, ChevronDown } from 'lucide-react';

interface ModeBriefsProps {
  engine: SubtractiveEngine;
  params: SynthParams;
  briefWork: Record<string, BriefWork>;
  onSaveBrief: (briefId: string, work: BriefWork) => void;
  onLoadParams: (p: SynthParams) => void;
  onGoToPlayground?: () => void;
  onGoToReport?: () => void;
}

// Kept for this visit only (nothing is stored): hints opened and notes typed, per brief.
const openedHints: Record<string, number> = {};
const draftNotes: Record<string, string> = {};
// Each brief starts from a blank patch. The patch a student was building is kept per brief (this visit
// only), so going back to a brief picks up where they left off instead of losing their work.
const briefDrafts: Record<string, SynthParams> = {};
let currentBriefId: string = SOUND_BRIEFS[0].id;
const startPatchFor = (id: string): SynthParams => ({ ...(briefDrafts[id] ?? DEFAULT_SYNTH_PARAMS) });
/** Call when leaving the Sound Design tab, so the patch being built is kept for next time. */
export const rememberBriefDraft = (p: SynthParams) => {
  briefDrafts[currentBriefId] = { ...p };
};

/**
 * Quest 4: Sound Design Briefs. Open-ended requests with no single right answer.
 * Students build a patch, test it in a musical context, and save it into their
 * submission code. The teacher listens and grades by ear.
 */
export const ModeBriefs: React.FC<ModeBriefsProps> = ({ engine, params, briefWork, onSaveBrief, onLoadParams, onGoToPlayground, onGoToReport }) => {
  const [activeId, setActiveId] = useState(currentBriefId);
  const [, rerender] = useState(0);
  const [justSaved, setJustSaved] = useState<string | null>(null);
  // Tips from the last save of each brief (this visit only).
  const [tips, setTips] = useState<Record<string, string[]>>({});
  const brief = SOUND_BRIEFS.find((b) => b.id === activeId)!;
  const hints = Math.max(openedHints[brief.id] ?? 0, briefWork[brief.id]?.hints ?? 0);
  const note = draftNotes[brief.id] ?? briefWork[brief.id]?.note ?? '';
  const saved = briefWork[brief.id];
  const changes = changedSettingsCount(params);
  const canSave = changes >= MIN_CHANGES_TO_SAVE;
  const savedCount = SOUND_BRIEFS.filter((b) => briefWork[b.id]).length;
  const brieTips = tips[brief.id] ?? [];

  // Opening the quest, or moving to another brief, starts that brief from a blank patch.
  useEffect(() => {
    onLoadParams(startPatchFor(activeId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectBrief = (id: string) => {
    if (id === activeId) return;
    stopPhrase();
    briefDrafts[activeId] = { ...params };
    currentBriefId = id;
    setActiveId(id);
    onLoadParams(startPatchFor(id));
  };

  const openHint = () => {
    openedHints[brief.id] = Math.min(2, hints + 1);
    rerender((n) => n + 1);
  };

  const save = () => {
    if (!canSave) return;
    setTips((prev) => ({ ...prev, [brief.id]: briefTips(brief.id, params) }));
    onSaveBrief(brief.id, { params: { ...params }, hints, ...(note.trim() ? { note: note.trim() } : {}) });
    setJustSaved(brief.id);
    setTimeout(() => setJustSaved((id) => (id === brief.id ? null : id)), 2500);
  };

  const groups: { kind: SoundBrief['kind']; icon: React.ReactNode }[] = [
    { kind: 'Music', icon: <Music className="w-3.5 h-3.5" /> },
    { kind: 'Sound FX', icon: <Sparkles className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="rounded-xl bg-gradient-to-r from-fuchsia-950/30 via-slate-900 to-slate-900 border border-fuchsia-500/30 p-4 shadow-xl">
      <div className="border-b border-white/10 pb-3 mb-3">
        <span className="text-[10px] font-mono text-fuchsia-300 uppercase tracking-widest font-bold">
          QUEST 4: SOUND DESIGN BRIEFS
          <span className="ml-2 normal-case tracking-normal text-sky-300 font-normal">· no single right answer. Your teacher listens to what you made.</span>
        </span>
        <h3 className="text-base font-bold text-white">Design a sound for a request</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4">
        {/* Brief list */}
        <div className="space-y-3">
          {groups.map((g) => (
            <div key={g.kind}>
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                {g.icon} {g.kind}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-1 gap-1">
                {SOUND_BRIEFS.filter((b) => b.kind === g.kind).map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => selectBrief(b.id)}
                    className={`text-left px-2.5 py-1.5 rounded-lg text-xs font-mono flex items-center justify-between gap-2 border ${
                      b.id === activeId
                        ? 'bg-fuchsia-500 text-black font-bold border-fuchsia-400'
                        : 'bg-slate-800/80 text-slate-200 border-white/5 hover:bg-slate-700'
                    }`}
                  >
                    <span className="truncate">{b.title}</span>
                    {briefWork[b.id] && <CheckCircle className={`w-3.5 h-3.5 shrink-0 ${b.id === activeId ? 'text-black' : 'text-emerald-400'}`} />}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <p className="text-[10px] text-slate-500 font-mono">
            {savedCount} of {BRIEFS_TO_FINISH} needed to finish ({savedCount}/{SOUND_BRIEFS.length} saved). Pick any {BRIEFS_TO_FINISH}.
          </p>
        </div>

        {/* Selected brief */}
        <div className="space-y-3 min-w-0">
          <div className="p-3 rounded-lg bg-black/40 border border-white/10">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-fuchsia-500/20 text-fuchsia-200">{brief.kind}</span>
              <h4 className="text-sm font-bold text-white">{brief.title}</h4>
            </div>
            <p className="text-sm text-slate-100 italic">“{brief.ask}”</p>
            <p className="text-[11px] text-slate-400 mt-1.5">
              <b className="text-slate-300">Listen for:</b> {brief.listenFor}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <PhraseButtons engine={engine} params={params} phrase={brief.phrase} accent="fuchsia" />
            <button
              type="button"
              onClick={() => onLoadParams({ ...DEFAULT_SYNTH_PARAMS })}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs flex items-center gap-1.5 border border-white/10"
              title="Start over from the plain Init patch"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Start from scratch
            </button>
            {saved && (
              <button
                type="button"
                onClick={() => onLoadParams({ ...saved.params })}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs flex items-center gap-1.5 border border-white/10"
              >
                <Upload className="w-3.5 h-3.5" /> Load my saved version
              </button>
            )}
          </div>

          {/* Hints */}
          <div className="p-3 rounded-lg bg-yellow-300/5 border border-yellow-300/30 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono text-yellow-300 font-bold flex items-center gap-1">
                <Lightbulb className="w-3.5 h-3.5" /> Need a place to start?
              </span>
              {hints < 2 && (
                <button
                  type="button"
                  onClick={openHint}
                  className="px-2.5 py-0.5 rounded-full bg-yellow-300 hover:bg-yellow-200 text-black text-[11px] font-mono font-bold"
                >
                  {hints === 0 ? 'Hint 1: where to start' : 'Hint 2: more specific'}
                </button>
              )}
            </div>
            {hints >= 1 && <p className="text-xs text-yellow-50"><b className="text-yellow-300 font-mono">1.</b> {brief.hints[0]}</p>}
            {hints >= 2 && <p className="text-xs text-yellow-50"><b className="text-yellow-300 font-mono">2.</b> {brief.hints[1]}</p>}
          </div>

          {/* Save */}
          <div className="p-3 rounded-lg bg-black/40 border border-white/10 space-y-2">
            <label className="block">
              <span className="block text-[11px] font-mono text-slate-300 mb-1">Describe your sound in a few words (optional):</span>
              <input
                type="text"
                value={note}
                maxLength={BRIEF_NOTE_MAX}
                onChange={(e) => {
                  draftNotes[brief.id] = e.target.value;
                  rerender((n) => n + 1);
                }}
                placeholder="e.g. slow LFO on the filter makes it wobble"
                className="w-full px-3 py-2 rounded-lg bg-black/50 text-fuchsia-100 font-mono text-xs border border-slate-700 focus:outline-none focus:ring-1 focus:ring-fuchsia-400 select-text"
              />
            </label>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-mono text-slate-400">
                {justSaved === brief.id
                  ? 'Saved! It goes into your Grade Report code.'
                  : !canSave
                  ? `Change at least ${MIN_CHANGES_TO_SAVE} settings from a starting patch to save (${changes} so far).`
                  : saved
                  ? 'Saving again replaces your earlier version.'
                  : 'Happy with it? Save it to your report.'}
              </span>
              <button
                type="button"
                onClick={save}
                disabled={!canSave}
                className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold font-mono text-xs uppercase flex items-center gap-1.5"
              >
                {justSaved === brief.id ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                {saved ? 'Save Again' : 'Save This Sound'}
              </button>
            </div>
            {brieTips.length > 0 && (
              <div className="p-2.5 rounded-lg bg-amber-400/10 border border-amber-300/40 text-xs text-amber-50 space-y-1" data-testid="brief-tips">
                <b className="text-amber-300 font-mono flex items-center gap-1">
                  <Lightbulb className="w-3.5 h-3.5" /> Saved, but this might not fit the brief yet. Tips:
                </b>
                <ul className="list-disc pl-5 space-y-0.5">
                  {brieTips.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
                <p className="text-amber-100/80">Adjust and save again to replace it, or keep it if you like how it sounds.</p>
              </div>
            )}
            {saved && (
              <details className="group">
                <summary className="cursor-pointer text-[11px] font-mono text-slate-400 hover:text-slate-200 flex items-center gap-1 list-none">
                  <ChevronDown className="w-3.5 h-3.5 group-open:rotate-180 transition-transform" /> What I saved
                </summary>
                <PatchParamList params={saved.params} className="mt-2" />
              </details>
            )}
          </div>
        </div>
      </div>
      {savedCount >= BRIEFS_TO_FINISH && (
        <QuestComplete
          quest="Sound Design"
          tone="fuchsia"
          summary={`${savedCount} sounds saved. Extra briefs are welcome: they show your teacher more of your style.`}
          onGoToPlayground={onGoToPlayground}
          onGoToReport={onGoToReport}
        />
      )}
    </div>
  );
};
