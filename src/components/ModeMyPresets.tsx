import React, { useEffect, useState } from 'react';
import { SynthParams, BriefWork, PhraseId, Preset } from '../types';
import { SubtractiveEngine } from '../audio/synthEngine';
import { INITIAL_PRESETS, DEFAULT_SYNTH_PARAMS } from '../utils/presets';
import { LEARN_BASE } from '../utils/learnSteps';
import { ADVENTURES, adventureInfo } from '../utils/adventures';
import { QuestComplete } from './QuestComplete';
import { MY_PRESET_SLOTS, MyPresetSlot, REMIX_MIN_CHANGES, ORIGINAL_MIN_CHANGES, PRESET_NAME_MAX } from '../utils/myPresets';
import { significantChanges } from '../utils/significance';
import { PHRASES, playPhrase, stopPhrase } from '../utils/playback';
import { PhraseButtons } from './PhraseButtons';
import { BRIEF_NOTE_MAX } from '../utils/briefs';
import { PatchParamList } from './PatchParamList';
import { Volume2, Save, CheckCircle, CheckCircle2, Circle, RotateCcw, Upload, ChevronDown, Shuffle, Compass, Sparkles, ArrowRight } from 'lucide-react';

interface ModeMyPresetsProps {
  engine: SubtractiveEngine;
  params: SynthParams;
  saved: Record<string, BriefWork>;
  onSave: (taskId: string, work: BriefWork) => void;
  onLoadParams: (p: SynthParams) => void;
  onGoToPlayground?: () => void;
  onGoToReport?: () => void;
}

/** Which test phrase suits each kind of preset. */
const CATEGORY_PHRASE: Record<Preset['category'], PhraseId> = {
  Bass: 'bassRiff',
  Lead: 'leadLine',
  Pad: 'padChords',
  Strings: 'padChords',
  Brass: 'padChords',
  Keys: 'padChords',
  Pluck: 'pluckArp',
  Drums: 'drumBeat',
  FX: 'longHit',
  Custom: 'leadLine',
};

// Kept for this visit only (nothing is stored): what each slot is based on, adventure progress, drafts.
const slotState: Record<string, { base?: string; step: number; name: string; note: string; phrase?: PhraseId; draft?: SynthParams }> = {};
const stateFor = (id: string) => (slotState[id] ??= { step: 0, name: '', note: '' });

let currentSlotId: string = MY_PRESET_SLOTS[0].id;
/** Call when leaving the My Presets tab, so an unfinished Original patch is still there when they come back. */
export const rememberMyPresetsDraft = (p: SynthParams) => {
  const s = MY_PRESET_SLOTS.find((x) => x.id === currentSlotId);
  if (s?.kind === 'original') stateFor(s.id).draft = { ...p };
};

const REMIXABLE = INITIAL_PRESETS.filter((p) => p.id !== 'init-patch');

export const ModeMyPresets: React.FC<ModeMyPresetsProps> = ({ engine, params, saved, onSave, onLoadParams, onGoToPlayground, onGoToReport }) => {
  const [activeId, setActiveId] = useState(currentSlotId);
  const [, rerender] = useState(0);
  const [justSaved, setJustSaved] = useState<string | null>(null);
  const refresh = () => rerender((n) => n + 1);

  const slot = MY_PRESET_SLOTS.find((s) => s.id === activeId)!;
  const st = stateFor(slot.id);
  const savedWork = saved[slot.id];
  // The other slot of the same kind, so the two remixes/adventures are different.
  const sibling = MY_PRESET_SLOTS.find((s) => s.kind === slot.kind && s.id !== slot.id);
  const siblingBase = sibling ? stateFor(sibling.id).base ?? saved[sibling.id]?.base : undefined;

  const restoreRef = React.useRef(params);
  restoreRef.current = params;

  // "Original" always starts from a blank patch (or from the patch they were building there).
  const startPatchFor = (s: MyPresetSlot): SynthParams => ({ ...(stateFor(s.id).draft ?? LEARN_BASE) });
  useEffect(() => {
    if (slot.kind === 'original') onLoadParams(startPatchFor(slot));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectSlot = (id: string) => {
    if (id === activeId) return;
    stopPhrase();
    // Keep an unfinished Original so a quick look at another slot doesn't lose it.
    if (slot.kind === 'original') stateFor(slot.id).draft = { ...params };
    const next = MY_PRESET_SLOTS.find((x) => x.id === id)!;
    currentSlotId = id;
    setActiveId(id);
    if (next.kind === 'original') onLoadParams(startPatchFor(next));
  };

  // ---------- What this slot needs before it can be saved ----------
  const remixBase = slot.kind === 'remix' ? REMIXABLE.find((p) => p.id === st.base) : undefined;
  const adventure = slot.kind === 'adventure' ? adventureInfo(st.base ?? '') : undefined;
  const remixChanges = remixBase ? significantChanges(params, remixBase.params) : [];
  const originalChanges = (() => {
    const a = significantChanges(params, DEFAULT_SYNTH_PARAMS);
    const b = significantChanges(params, LEARN_BASE);
    return a.length <= b.length ? a : b;
  })();
  const phrase: PhraseId =
    slot.kind === 'remix'
      ? CATEGORY_PHRASE[remixBase?.category ?? 'Custom']
      : slot.kind === 'adventure'
      ? adventure?.phrase ?? 'leadLine'
      : st.phrase ?? 'leadLine';

  let ready = false;
  let needs = '';
  if (slot.kind === 'remix') {
    ready = !!remixBase && remixChanges.length >= REMIX_MIN_CHANGES;
    needs = !remixBase ? 'Pick a preset first.' : `Make at least ${REMIX_MIN_CHANGES} big changes (${remixChanges.length} so far).`;
  } else if (slot.kind === 'adventure') {
    ready = !!adventure && st.step >= adventure.steps.length;
    needs = !adventure ? 'Pick a sound type first.' : 'Finish every step first.';
  } else {
    ready = originalChanges.length >= ORIGINAL_MIN_CHANGES;
    needs = `Make at least ${ORIGINAL_MIN_CHANGES} big changes from the blank patch (${originalChanges.length} so far).`;
  }
  const nameOk = st.name.trim().length > 0;

  const save = () => {
    if (!ready || !nameOk) return;
    onSave(slot.id, {
      params: { ...params },
      hints: 0,
      name: st.name.trim(),
      ...(st.note.trim() ? { note: st.note.trim() } : {}),
      ...(st.base ? { base: st.base } : {}),
      phrase,
    });
    setJustSaved(slot.id);
    setTimeout(() => setJustSaved((id) => (id === slot.id ? null : id)), 2500);
  };

  const chooseBase = (base: string, patch: SynthParams) => {
    st.base = base;
    st.step = 0;
    onLoadParams({ ...patch });
    refresh();
  };
  const clearBase = () => {
    st.base = undefined;
    st.step = 0;
    refresh();
  };

  const kindIcon = (s: MyPresetSlot) =>
    s.kind === 'remix' ? <Shuffle className="w-3.5 h-3.5" /> : s.kind === 'adventure' ? <Compass className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />;

  const btn = 'px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs flex items-center gap-1.5 border border-white/10';

  return (
    <div className="rounded-xl bg-gradient-to-r from-violet-950/40 via-slate-900 to-slate-900 border border-violet-500/30 p-4 shadow-xl">
      <div className="border-b border-white/10 pb-3 mb-3">
        <span className="text-[10px] font-mono text-violet-300 uppercase tracking-widest font-bold">
          QUEST 3: MY PRESETS
          <span className="ml-2 normal-case tracking-normal text-sky-300 font-normal">· build your own sounds. Your teacher listens to what you made.</span>
        </span>
        <h3 className="text-base font-bold text-white">Remix it, build it, invent it</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4">
        {/* Slots */}
        <div className="space-y-1">
          {MY_PRESET_SLOTS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => selectSlot(s.id)}
              className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono flex items-center gap-2 border ${
                s.id === activeId ? 'bg-violet-500 text-black font-bold border-violet-400' : 'bg-slate-800/80 text-slate-200 border-white/5 hover:bg-slate-700'
              }`}
            >
              {kindIcon(s)}
              <span className="flex-1 truncate">
                {s.title}
                {saved[s.id]?.name && <span className={s.id === activeId ? 'text-black/70' : 'text-slate-400'}> · {saved[s.id].name}</span>}
              </span>
              {saved[s.id] && <CheckCircle className={`w-3.5 h-3.5 shrink-0 ${s.id === activeId ? 'text-black' : 'text-emerald-400'}`} />}
            </button>
          ))}
          <p className="text-[10px] text-slate-500 font-mono pt-1">
            {MY_PRESET_SLOTS.filter((s) => saved[s.id]).length} of {MY_PRESET_SLOTS.length} saved
          </p>
        </div>

        {/* Active slot */}
        <div className="space-y-3 min-w-0">
          <div className="p-3 rounded-lg bg-black/40 border border-white/10">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              {kindIcon(slot)} {slot.title}
            </h4>
            <p className="text-xs text-slate-300 mt-0.5">{slot.blurb}</p>
          </div>

          {/* ----- Remix ----- */}
          {slot.kind === 'remix' && !remixBase && (
            <div>
              <p className="text-xs text-slate-300 mb-2">Pick a preset to remix. It loads onto the synth; then change it until it’s yours.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {REMIXABLE.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={p.id === siblingBase}
                    onClick={() => chooseBase(p.id, p.params)}
                    title={p.id === siblingBase ? 'Already used in your other remix' : p.description}
                    className="text-left px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/10 text-xs disabled:opacity-35 disabled:cursor-not-allowed"
                  >
                    <span className="block font-bold text-slate-100">{p.name}</span>
                    <span className="block text-[10px] font-mono text-slate-400">{p.category}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {slot.kind === 'remix' && remixBase && (
            <div className="space-y-2">
              <div className="p-3 rounded-lg bg-violet-500/5 border border-violet-500/25 text-xs text-slate-300">
                <b className="text-violet-200">Remixing “{remixBase.name}.”</b> {remixBase.why}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => playPhrase(engine, PHRASES[phrase].notes, { params: remixBase.params, restore: () => restoreRef.current })}
                  className={btn}
                >
                  <Volume2 className="w-3.5 h-3.5 text-violet-300" /> Play the original
                </button>
                <PhraseButtons engine={engine} params={params} phrase={phrase} accent="violet" playText="Play my remix" />
                <button type="button" onClick={() => onLoadParams({ ...remixBase.params })} className={btn}>
                  <RotateCcw className="w-3.5 h-3.5" /> Back to the original
                </button>
                <button type="button" onClick={clearBase} className={btn}>
                  Pick a different preset
                </button>
              </div>
              <div className="p-3 rounded-lg bg-black/40 border border-white/10">
                <div className="text-[11px] font-mono text-slate-300 mb-1.5">
                  Big changes: <b className={remixChanges.length >= REMIX_MIN_CHANGES ? 'text-emerald-300' : 'text-amber-300'}>{remixChanges.length}</b> / {REMIX_MIN_CHANGES}
                  <span className="text-slate-500"> · tiny knob nudges don’t count, so make changes you can hear</span>
                </div>
                {remixChanges.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {remixChanges.map((c) => (
                      <span key={c.label} className="px-2 py-0.5 rounded bg-violet-500/15 border border-violet-500/30 text-[10px] font-mono text-violet-100">
                        {c.label}: {c.from} → {c.to}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ----- Adventure ----- */}
          {slot.kind === 'adventure' && !adventure && (
            <div>
              <p className="text-xs text-slate-300 mb-2">What do you want to build? You’ll start from a blank patch and build it one section at a time.</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {ADVENTURES.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    disabled={a.id === siblingBase}
                    onClick={() => chooseBase(a.id, LEARN_BASE)}
                    title={a.id === siblingBase ? 'Already used in your other adventure' : a.blurb}
                    className="text-left px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/10 text-xs disabled:opacity-35 disabled:cursor-not-allowed"
                  >
                    <span className="block font-bold text-slate-100">{a.name}</span>
                    <span className="block text-[10px] text-slate-400 leading-tight">{a.blurb}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {slot.kind === 'adventure' && adventure && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-mono text-violet-200 font-bold">Building: {adventure.name}</span>
                <PhraseButtons engine={engine} params={params} phrase={adventure.phrase} accent="violet" />
                <button
                  type="button"
                  onClick={() => {
                    st.step = 0;
                    onLoadParams({ ...LEARN_BASE });
                    refresh();
                  }}
                  className={btn}
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Start over
                </button>
                <button type="button" onClick={clearBase} className={btn}>
                  Pick another type
                </button>
              </div>
              <ol className="space-y-1.5">
                {adventure.steps.map((s, i) => {
                  const done = i < st.step;
                  const current = i === st.step;
                  const inRange = s.check(params);
                  if (!done && !current) {
                    return (
                      <li key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/20 text-xs text-slate-500">
                        <Circle className="w-4 h-4 shrink-0" /> {i + 1}. {s.title}
                      </li>
                    );
                  }
                  if (done) {
                    return (
                      <li key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/20 text-xs text-emerald-200">
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" /> {i + 1}. {s.title}
                        {!inRange && <span className="text-[10px] text-amber-300/80 font-mono">(changed since: that’s fine if you like it)</span>}
                      </li>
                    );
                  }
                  return (
                    <li key={i} className="p-3 rounded-lg bg-black/40 border border-violet-500/40 space-y-1.5">
                      <div className="text-xs font-bold text-white">
                        {i + 1}. {s.title}
                      </div>
                      <p className="text-xs text-slate-200">{s.text}</p>
                      {s.taste && (
                        <p className="text-[11px] text-violet-200">
                          <b className="font-mono">Your call:</b> {s.taste}
                        </p>
                      )}
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <span className={`text-[11px] font-mono ${inRange ? 'text-emerald-300' : 'text-slate-400'}`}>
                          {inRange ? 'In range. Listen, adjust to taste, then go on.' : 'Not in range yet.'}
                        </span>
                        <button
                          type="button"
                          disabled={!inRange}
                          onClick={() => {
                            st.step = i + 1;
                            refresh();
                          }}
                          className="px-3 py-1.5 rounded-lg bg-violet-500 hover:bg-violet-400 disabled:bg-slate-800 disabled:text-slate-500 text-black font-bold font-mono text-xs flex items-center gap-1"
                        >
                          {i === adventure.steps.length - 1 ? 'Finish' : 'Next step'} <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ol>
              {st.step >= adventure.steps.length && (
                <p className="text-xs text-emerald-200">All steps done. Keep tweaking until it sounds like yours, then name it and save it.</p>
              )}
            </div>
          )}

          {/* ----- Original ----- */}
          {slot.kind === 'original' && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => onLoadParams({ ...LEARN_BASE })} className={btn}>
                  <RotateCcw className="w-3.5 h-3.5" /> Start from a blank patch
                </button>
                <label className="flex items-center gap-1.5 text-xs font-mono text-slate-300">
                  Phrase:
                  <select
                    value={phrase}
                    onChange={(e) => {
                      st.phrase = e.target.value as PhraseId;
                      refresh();
                    }}
                    className="bg-slate-900 border border-white/20 rounded-lg px-2 py-1 text-slate-200"
                  >
                    {(Object.keys(PHRASES) as PhraseId[]).map((k) => (
                      <option key={k} value={k}>
                        {PHRASES[k].label}
                      </option>
                    ))}
                  </select>
                </label>
                <PhraseButtons engine={engine} params={params} phrase={phrase} accent="violet" />
              </div>
              <p className="text-[11px] font-mono text-slate-400">
                Big changes from a blank patch:{' '}
                <b className={originalChanges.length >= ORIGINAL_MIN_CHANGES ? 'text-emerald-300' : 'text-amber-300'}>{originalChanges.length}</b> / {ORIGINAL_MIN_CHANGES}
              </p>
            </div>
          )}

          {/* ----- Name and save ----- */}
          <div className="p-3 rounded-lg bg-black/40 border border-white/10 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.4fr] gap-2">
              <label className="block">
                <span className="block text-[11px] font-mono text-slate-300 mb-1">Preset name:</span>
                <input
                  type="text"
                  value={st.name}
                  maxLength={PRESET_NAME_MAX}
                  onChange={(e) => {
                    st.name = e.target.value;
                    refresh();
                  }}
                  placeholder="e.g. Midnight Wobble"
                  className="w-full px-3 py-2 rounded-lg bg-black/50 text-violet-100 font-mono text-xs border border-slate-700 focus:outline-none focus:ring-1 focus:ring-violet-400 select-text"
                />
              </label>
              <label className="block">
                <span className="block text-[11px] font-mono text-slate-300 mb-1">What is it for, or what did you change? (optional)</span>
                <input
                  type="text"
                  value={st.note}
                  maxLength={BRIEF_NOTE_MAX}
                  onChange={(e) => {
                    st.note = e.target.value;
                    refresh();
                  }}
                  placeholder="e.g. a darker version for a chill beat"
                  className="w-full px-3 py-2 rounded-lg bg-black/50 text-violet-100 font-mono text-xs border border-slate-700 focus:outline-none focus:ring-1 focus:ring-violet-400 select-text"
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-mono text-slate-400">
                {justSaved === slot.id
                  ? 'Saved! It goes into your Grade Report code.'
                  : !ready
                  ? needs
                  : !nameOk
                  ? 'Give it a name to save it.'
                  : savedWork
                  ? 'Saving again replaces your earlier version.'
                  : 'Ready to save.'}
              </span>
              <div className="flex gap-2">
                {savedWork && (
                  <button type="button" onClick={() => onLoadParams({ ...savedWork.params })} className={btn}>
                    <Upload className="w-3.5 h-3.5" /> Load saved
                  </button>
                )}
                <button
                  type="button"
                  onClick={save}
                  disabled={!ready || !nameOk}
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold font-mono text-xs uppercase flex items-center gap-1.5"
                >
                  {justSaved === slot.id ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                  {savedWork ? 'Save Again' : 'Save Preset'}
                </button>
              </div>
            </div>
            {savedWork && (
              <details className="group">
                <summary className="cursor-pointer text-[11px] font-mono text-slate-400 hover:text-slate-200 flex items-center gap-1 list-none">
                  <ChevronDown className="w-3.5 h-3.5 group-open:rotate-180 transition-transform" /> What I saved: “{savedWork.name}”
                </summary>
                <PatchParamList params={savedWork.params} className="mt-2" />
              </details>
            )}
          </div>
        </div>
      </div>
      {MY_PRESET_SLOTS.every((x) => saved[x.id]) && (
        <QuestComplete
          quest="My Presets"
          tone="violet"
          summary="All five of your own sounds are saved. That is a real patch library!"
          onGoToPlayground={onGoToPlayground}
          onGoToReport={onGoToReport}
        />
      )}
    </div>
  );
};
