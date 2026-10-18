import React, { useEffect, useRef, useState } from 'react';
import { ThemeMode, SynthParams } from '../types';
import { SubtractiveEngine } from '../audio/synthEngine';
import { AdsrVisualizer } from './AdsrVisualizer';
import { WaveformIcon } from './WaveformIcons';
import { LEARN_STEPS, LEARN_BASE, FlowPart, fillKnobNames } from '../utils/learnSteps';
import { playPhrase } from '../utils/playback';
import { CheckCircle2, ChevronRight, ChevronLeft, Volume2, RotateCcw, Circle, Ear, Trophy, ArrowRight } from 'lucide-react';

interface ModeLearnProps {
  engine: SubtractiveEngine;
  theme: ThemeMode;
  params: SynthParams;
  onLoadParams: (p: SynthParams) => void;
  /** Glow a panel on the synth ('vco', 'filter', 'envelope', 'lfo'), or null for none. */
  onHighlight: (section: string | null) => void;
  onGoToChallenges: () => void;
}

// Progress lives for this visit only (nothing is stored), and survives switching tabs.
const progress = {
  step: 0,
  started: false,
  /** Missions finished, per step. */
  done: LEARN_STEPS.map(() => 0),
  finished: false,
};

const FLOW: { part: FlowPart; label: string }[] = [
  { part: 'osc', label: 'VCO 1 + 2' },
  { part: 'noise', label: 'Noise' },
  { part: 'filter', label: 'Filter' },
  { part: 'amp', label: 'Amp' },
];
const MODS: { part: FlowPart; label: string; to: string }[] = [
  { part: 'filterEnv', label: 'Filter EG', to: 'filter' },
  { part: 'ampEnv', label: 'Amp EG', to: 'amp' },
  { part: 'lfo', label: 'LFO', to: 'pitch · filter · PW' },
];

/** The whole signal path in one line, with this step's parts lit. */
const FlowStrip: React.FC<{ lit: FlowPart[] }> = ({ lit }) => {
  const box = (on: boolean) =>
    `px-2 py-1 rounded-md border text-[10px] font-mono font-bold uppercase tracking-wide transition-colors ${
      on ? 'bg-amber-400 text-black border-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.5)]' : 'bg-black/40 text-slate-400 border-white/10'
    }`;
  return (
    <div className="flex flex-col gap-1 items-start md:items-end" aria-label="Signal path">
      <div className="flex items-center gap-1 flex-wrap">
        <div className="flex flex-col gap-0.5">
          <span className={box(lit.includes('osc'))}>{FLOW[0].label}</span>
          <span className={box(lit.includes('noise'))}>{FLOW[1].label}</span>
        </div>
        <span className="text-slate-500 text-xs">→</span>
        <span className={box(lit.includes('filter'))}>{FLOW[2].label}</span>
        <span className="text-slate-500 text-xs">→</span>
        <span className={box(lit.includes('amp'))}>{FLOW[3].label}</span>
        <span className="text-slate-500 text-xs">→ 🔊</span>
      </div>
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-[9px] font-mono text-slate-500 uppercase">moved by:</span>
        {MODS.map((m) => (
          <span key={m.part} className={box(lit.includes(m.part))} title={`moves the ${m.to}`}>
            {m.label} <span className="font-normal normal-case opacity-70">→ {m.to}</span>
          </span>
        ))}
      </div>
    </div>
  );
};

const WAVES = [
  { type: 'sawtooth', name: 'Saw', desc: 'every harmonic: bright, buzzy' },
  { type: 'square', name: 'Square', desc: 'odd harmonics: hollow' },
  { type: 'triangle', name: 'Triangle', desc: 'a few: soft, flute-like' },
  { type: 'sine', name: 'Sine', desc: 'none: pure, round' },
];

export const ModeLearn: React.FC<ModeLearnProps> = ({ engine, theme, params, onLoadParams, onHighlight, onGoToChallenges }) => {
  const [stepIdx, setStepIdx] = useState(progress.step);
  const [done, setDone] = useState<number[]>(progress.done);
  const [finished, setFinished] = useState(progress.finished);
  const [isPlaying, setIsPlaying] = useState(false);
  const step = LEARN_STEPS[stepIdx];
  const missionsDone = done[stepIdx];
  const stepComplete = missionsDone >= step.missions.length;
  const current = step.missions[missionsDone];

  // Latest values for the "did they listen?" check, which runs from an engine callback.
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const stateRef = useRef({ stepIdx, done });
  stateRef.current = { stepIdx, done };

  useEffect(() => {
    progress.step = stepIdx;
    progress.done = done;
    progress.finished = finished;
  }, [stepIdx, done, finished]);

  const loadStep = (idx: number) => onLoadParams({ ...LEARN_BASE, ...LEARN_STEPS[idx].start });

  // First visit: load step 1's starting patch. Glow the step's panel while Learn is open.
  useEffect(() => {
    if (!progress.started) {
      progress.started = true;
      loadStep(stepIdx);
    }
    return () => onHighlight(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    onHighlight(finished ? null : step.section);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx, finished]);

  // A mission counts once its settings are right AND a note is heard with them
  // (from Listen, the on-screen keys, the computer keyboard or MIDI).
  // One mission per listen: notes of a chord arrive together, so ignore the rest of that burst.
  const lastAdvanceRef = useRef(0);
  useEffect(() => {
    return engine.subscribeEnvelope((isHeld) => {
      if (!isHeld || performance.now() - lastAdvanceRef.current < 400) return;
      const i = stateRef.current.stepIdx;
      const m = LEARN_STEPS[i].missions[stateRef.current.done[i]];
      if (!m || !m.check(paramsRef.current)) return;
      lastAdvanceRef.current = performance.now();
      setDone((prev) => prev.map((n, j) => (j === i ? Math.min(LEARN_STEPS[i].missions.length, n + 1) : n)));
    });
  }, [engine]);

  const goTo = (idx: number) => {
    if (idx < 0 || idx >= LEARN_STEPS.length) return;
    setFinished(false);
    setStepIdx(idx);
    loadStep(idx);
  };

  const listen = async () => {
    setIsPlaying(true);
    await playPhrase(engine, step.phrase, { onDone: () => setIsPlaying(false) });
  };

  const settingsRight = current ? current.check(params) : false;
  const firstUnfinished = done.findIndex((n, i) => n < LEARN_STEPS[i].missions.length);
  const reachable = (i: number) => i <= (firstUnfinished === -1 ? LEARN_STEPS.length - 1 : firstUnfinished);

  if (finished) {
    return (
      <div id="mode-learn-overlay" className="rounded-xl bg-gradient-to-r from-emerald-950/70 via-slate-900 to-indigo-950/70 p-5 border border-emerald-500/40 shadow-2xl text-slate-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-mono tracking-widest text-emerald-300 uppercase font-bold">Walkthrough complete</span>
            <h3 className="text-lg font-bold text-white">You’ve been through the whole signal path.</h3>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              Oscillators make the raw sound, the filter carves it, the amp shapes its volume, and envelopes and the LFO move things
              for you. Now put it to work: train your ears, fix broken patches, match sounds, and design your own.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            <button
              type="button"
              onClick={() => goTo(0)}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono border border-white/10 flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Review steps
            </button>
            <button
              type="button"
              onClick={onGoToChallenges}
              className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-mono font-bold uppercase flex items-center gap-1.5"
            >
              <Trophy className="w-4 h-4" /> Go to Challenges <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="mode-learn-overlay" className="rounded-xl bg-gradient-to-r from-amber-950/70 via-slate-900 to-indigo-950/70 p-4 border border-amber-500/40 shadow-2xl text-slate-100">
      {/* Header: step + flow strip */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 border-b border-amber-500/20 pb-3 mb-3">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500 text-black font-bold text-sm shrink-0">{stepIdx + 1}</span>
          <div>
            <span className="text-[10px] font-mono tracking-widest text-amber-300 uppercase font-bold">
              Step {stepIdx + 1} of {LEARN_STEPS.length}
            </span>
            <h3 className="text-lg font-bold text-white leading-tight">{step.title}</h3>
          </div>
        </div>
        <FlowStrip lit={step.flow} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1.25fr_1fr] gap-4">
        {/* Explanation */}
        <div className="space-y-2.5 min-w-0">
          <p className="text-sm text-slate-200 leading-relaxed">{fillKnobNames(step.what, theme)}</p>
          <p className="text-xs text-sky-200 flex items-start gap-1.5">
            <Ear className="w-4 h-4 shrink-0 text-sky-300" />
            <span>
              <b>Listen for:</b> {step.listen}
            </span>
          </p>
          {step.extra === 'waves' && (
            <div className="grid grid-cols-4 gap-1.5">
              {WAVES.map((w) => (
                <div
                  key={w.type}
                  className={`p-1.5 rounded-lg border flex flex-col items-center text-center ${
                    params.vco1Waveform === w.type ? 'bg-amber-500/15 border-amber-400/60' : 'bg-black/40 border-white/10'
                  }`}
                >
                  <WaveformIcon type={w.type as any} size={22} className="w-5 h-5 text-amber-300" />
                  <span className="text-[11px] font-bold text-amber-200 font-mono">{w.name}</span>
                  <span className="text-[9px] text-slate-400 leading-tight">{w.desc}</span>
                </div>
              ))}
            </div>
          )}
          {(step.extra === 'ampEnv' || step.extra === 'filterEnv') && (
            <div className="p-2 rounded-lg bg-black/50 border border-amber-500/30 max-w-md">
              <span className="text-[10px] font-mono text-amber-300 font-bold block mb-1 uppercase tracking-wide">
                {step.extra === 'ampEnv' ? 'Your Amp EG' : 'Your Filter EG'}
              </span>
              <AdsrVisualizer
                attack={step.extra === 'ampEnv' ? params.ampAttack : params.modAttack}
                decay={step.extra === 'ampEnv' ? params.ampDecay : params.modDecay}
                sustain={step.extra === 'ampEnv' ? params.ampSustain : params.modSustain}
                release={step.extra === 'ampEnv' ? params.ampRelease : params.modRelease}
                height={84}
                theme="diagram"
                engine={engine}
              />
            </div>
          )}
        </div>

        {/* Missions */}
        <div className="p-3 rounded-lg bg-black/40 border border-white/10 flex flex-col gap-2.5">
          <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider font-mono">Try it</span>
          <ol className="space-y-1.5">
            {step.missions.map((m, i) => {
              const isDone = i < missionsDone;
              const isCurrent = i === missionsDone;
              return (
                <li key={i} className={`flex items-start gap-2 text-xs ${isDone ? 'text-emerald-300' : isCurrent ? 'text-slate-100' : 'text-slate-500'}`}>
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  ) : (
                    <Circle className={`w-4 h-4 shrink-0 ${isCurrent ? 'text-amber-400' : 'text-slate-600'}`} />
                  )}
                  <span>{fillKnobNames(m.text, theme)}</span>
                </li>
              );
            })}
          </ol>

          <div className="flex flex-wrap items-center gap-2 mt-auto">
            <button
              type="button"
              onClick={listen}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 active:scale-95 transition-all ${
                settingsRight ? 'bg-amber-400 hover:bg-amber-300 text-black animate-pulse' : 'bg-amber-500 hover:bg-amber-400 text-black'
              }`}
            >
              <Volume2 className="w-4 h-4" />
              {isPlaying ? 'Playing…' : 'Listen'}
            </button>
            <span className="text-[11px] font-mono text-slate-400">
              {stepComplete
                ? 'Step done!'
                : settingsRight
                ? 'Settings look right. Now listen to it!'
                : 'Change the setting, then listen (or play the keys).'}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/10 text-xs">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={stepIdx === 0}
            onClick={() => goTo(stepIdx - 1)}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-slate-300 flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          <button
            type="button"
            onClick={() => loadStep(stepIdx)}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1"
            title="Put this step's starting sound back on the synth"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset sound
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-1.5">
          {LEARN_STEPS.map((s, i) => {
            const complete = done[i] >= s.missions.length;
            return (
              <button
                key={i}
                type="button"
                disabled={!reachable(i)}
                onClick={() => goTo(i)}
                title={`${i + 1}. ${s.title}`}
                className={`w-2.5 h-2.5 rounded-full transition-all disabled:cursor-not-allowed ${
                  i === stepIdx ? 'bg-amber-400 scale-125' : complete ? 'bg-emerald-400' : 'bg-slate-700'
                }`}
              />
            );
          })}
        </div>

        <button
          type="button"
          disabled={!stepComplete}
          onClick={() => (stepIdx === LEARN_STEPS.length - 1 ? setFinished(true) : goTo(stepIdx + 1))}
          className={`px-4 py-1.5 rounded font-bold flex items-center gap-1 transition-all ${
            stepComplete ? 'bg-amber-400 hover:bg-amber-300 text-black' : 'bg-slate-800 text-slate-500 cursor-not-allowed'
          }`}
        >
          <span>{stepIdx === LEARN_STEPS.length - 1 ? 'Finish' : 'Next Step'}</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
