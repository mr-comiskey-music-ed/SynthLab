import React, { useEffect, useId, useRef, useState } from 'react';
import { ThemeMode, SynthParams } from '../types';
import { SubtractiveEngine } from '../audio/synthEngine';
import { AdsrVisualizer } from './AdsrVisualizer';
import { WaveformIcon } from './WaveformIcons';
import { LEARN_STEPS, LEARN_BASE, FlowPart, fillKnobNames } from '../utils/learnSteps';
import { playPhrase } from '../utils/playback';
import { learnProgress } from '../utils/learnProgress';
import { CheckCircle2, ChevronRight, ChevronLeft, Volume2, RotateCcw, Circle, Ear, Trophy, ArrowRight, Activity } from 'lucide-react';

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
// It is shared so the Grade Report can tell whether the student went through Learn.
const progress = learnProgress;

const CAPTIONS: Record<FlowPart, string> = {
  osc: 'Oscillators make the raw tone',
  noise: 'Noise adds hiss and air',
  filter: 'Filter removes harmonics: bright to dark',
  amp: 'Amp sets the loudness',
  filterEnv: 'Filter EG moves the cutoff over each note',
  ampEnv: 'Amp EG shapes the loudness of each note',
  lfo: 'LFO wobbles pitch, cutoff or pulse width',
};

/**
 * The whole signal path as a diagram, with this step's parts lit.
 * Sound flows left to right along the top; the things that MOVE settings sit underneath,
 * each with a dashed arrow into exactly what it moves.
 */
const FlowStrip: React.FC<{ lit: FlowPart[] }> = ({ lit }) => {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const mk = { flow: `flow-arrow-${uid}`, on: `mod-arrow-on-${uid}`, off: `mod-arrow-off-${uid}` };
  const on = (p: FlowPart) => lit.includes(p);
  const box = (p: FlowPart) =>
    on(p)
      ? { fill: '#fbbf24', stroke: '#fde68a', text: '#111827' }
      : { fill: 'rgba(0,0,0,0.4)', stroke: 'rgba(255,255,255,0.14)', text: '#94a3b8' };
  const FONT = "'Barlow Semi Condensed', 'Barlow', system-ui, sans-serif";
  const Block: React.FC<{ part: FlowPart; x: number; y: number; w: number; h: number; label: string }> = ({ part, x, y, w, h, label }) => {
    const c = box(part);
    return (
      <g style={on(part) ? { filter: 'drop-shadow(0 0 5px rgba(251,191,36,0.6))' } : undefined}>
        <rect x={x} y={y} width={w} height={h} rx={7} fill={c.fill} stroke={c.stroke} strokeWidth={1.5} />
        <text x={x + w / 2} y={y + h / 2 + 4} textAnchor="middle" fontSize={13} fontWeight={700} fill={c.text} fontFamily={FONT} letterSpacing="0.06em">
          {label}
        </text>
      </g>
    );
  };
  // A modulator's arrow glows cyan when that modulator is the lit one.
  const mod = (p: FlowPart) => (on(p) ? '#22d3ee' : 'rgba(148,163,184,0.45)');
  const sound = 'rgba(203,213,225,0.7)';

  return (
    <div className="w-full md:flex-1 md:max-w-[46rem] min-w-0" aria-label="Signal path">
      <svg viewBox="0 0 700 100" className="w-full h-auto block" role="img" aria-label="Oscillators and noise go through the filter and amp to the speaker; the filter envelope, amp envelope and LFO move settings along the way">
        <defs>
          <marker id={mk.flow} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0 L8 4 L0 8 z" fill={sound} />
          </marker>
          <marker id={mk.on} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0 L8 4 L0 8 z" fill="#22d3ee" />
          </marker>
          <marker id={mk.off} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0 L8 4 L0 8 z" fill="rgba(148,163,184,0.6)" />
          </marker>
        </defs>

        {/* Sound path, left to right */}
        <Block part="noise" x={0} y={0} w={120} h={20} label="NOISE" />
        <Block part="osc" x={0} y={24} w={120} h={30} label="VCO 1 + 2" />
        <path d="M120 10 H190 V39" fill="none" stroke={sound} strokeWidth={1.5} />
        <path d="M120 39 H268" fill="none" stroke={sound} strokeWidth={1.5} markerEnd={`url(#${mk.flow})`} />
        <Block part="filter" x={272} y={24} w={120} h={30} label="FILTER" />
        <path d="M392 39 H508" fill="none" stroke={sound} strokeWidth={1.5} markerEnd={`url(#${mk.flow})`} />
        <Block part="amp" x={512} y={24} w={100} h={30} label="AMP" />
        <path d="M612 39 H648" fill="none" stroke={sound} strokeWidth={1.5} markerEnd={`url(#${mk.flow})`} />
        <text x={672} y={47} textAnchor="middle" fontSize={24}>🔊</text>

        {/* What moves them: dashed arrows into exactly what they move */}
        <Block part="lfo" x={0} y={76} w={120} h={24} label="LFO" />
        <Block part="filterEnv" x={272} y={76} w={120} h={24} label="FILTER EG" />
        <Block part="ampEnv" x={512} y={76} w={100} h={24} label="AMP EG" />

        <path d="M40 76 V56" fill="none" stroke={mod('lfo')} strokeWidth={1.75} strokeDasharray="4 3" markerEnd={`url(#${on('lfo') ? mk.on : mk.off})`} />
        <text x={46} y={69} fontSize={10} fill={mod('lfo')} fontFamily={FONT}>pitch · PW</text>
        <path d="M112 76 V64 H300 V56" fill="none" stroke={mod('lfo')} strokeWidth={1.75} strokeDasharray="4 3" markerEnd={`url(#${on('lfo') ? mk.on : mk.off})`} />
        <text x={150} y={60} fontSize={10} fill={mod('lfo')} fontFamily={FONT}>cutoff</text>
        <path d="M352 76 V56" fill="none" stroke={mod('filterEnv')} strokeWidth={1.75} strokeDasharray="4 3" markerEnd={`url(#${on('filterEnv') ? mk.on : mk.off})`} />
        <text x={358} y={69} fontSize={10} fill={mod('filterEnv')} fontFamily={FONT}>cutoff</text>
        <path d="M562 76 V56" fill="none" stroke={mod('ampEnv')} strokeWidth={1.75} strokeDasharray="4 3" markerEnd={`url(#${on('ampEnv') ? mk.on : mk.off})`} />
        <text x={568} y={69} fontSize={10} fill={mod('ampEnv')} fontFamily={FONT}>volume</text>
      </svg>
    </div>
  );
};

/** Tight labels for the step buttons. */
const SHORT_TITLES = ['Waves', 'Two VCOs', 'Pulse width', 'Noise', 'Cutoff', 'Resonance', 'Amp EG', 'Filter EG', 'LFO'];

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
    onHighlight(finished ? null : step.knob ? `${step.section}+${step.knob}` : step.section);
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

  const firstUnfinished = done.findIndex((n, i) => n < LEARN_STEPS[i].missions.length);
  // Once every step has been completed, the student can jump to any step and move on freely:
  // nothing has to be redone just to review.
  const allDone = firstUnfinished === -1;
  const reachable = (i: number) => allDone || i <= firstUnfinished;

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
              <Trophy className="w-4 h-4" /> Start Challenges <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Every step is drawn in the same grid cell and only the current one is visible, so the panel is always
  // as tall as the tallest step and nothing below it jumps around when the student changes steps.
  const renderStep = (i: number, active: boolean) => {
    const st = LEARN_STEPS[i];
    const md = done[i];
    const cur = st.missions[md];
    const right = active && cur ? cur.check(params) : false;
    const complete = md >= st.missions.length;
    return (
      <div key={i} className={`[grid-area:1/1] min-w-0 ${active ? '' : 'invisible pointer-events-none'}`} aria-hidden={!active} inert={!active}>
      {/* Header: step + flow strip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-amber-500/20 pb-3 mb-3">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500 text-black font-bold text-sm shrink-0">{i + 1}</span>
          <div>
            <span className="text-[10px] font-mono tracking-widest text-amber-300 uppercase font-bold">
              Step {i + 1} of {LEARN_STEPS.length}
            </span>
            <h3 className="text-lg font-bold text-white leading-tight">{st.title}</h3>
            <p className="text-[11px] font-mono text-amber-200/80 leading-snug mt-0.5">
              {st.flow.map((p) => CAPTIONS[p]).join('  ·  ')}
            </p>
          </div>
        </div>
        <FlowStrip lit={st.flow} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1.25fr_1fr] gap-4">
        {/* Explanation */}
        <div className="space-y-2.5 min-w-0">
          <p className="text-sm text-slate-200 leading-relaxed">{fillKnobNames(st.what, theme)}</p>
          <p className="text-xs text-sky-200 flex items-start gap-1.5">
            <Ear className="w-4 h-4 shrink-0 text-sky-300" />
            <span>
              <b>Listen for:</b> {st.listen}
            </span>
          </p>
          {st.scope && (
            <p className="text-xs text-emerald-200 flex items-start gap-1.5 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/25" data-testid="learn-scope-tip">
              <Activity className="w-4 h-4 shrink-0 text-emerald-300" />
              <span>{st.scope}</span>
            </p>
          )}
          {st.extra === 'waves' && (
            <div>
              {/* A reference chart, not controls: nothing here is clickable or "selected" */}
              <span className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1">
                The four wave shapes (a chart to read, not buttons). Change the wave with the Waveform control on the synth below.
              </span>
              <div className="grid grid-cols-4 gap-1.5 pointer-events-none select-none" aria-label="Reference chart of the four wave shapes">
                {WAVES.map((w) => (
                  <div key={w.type} className="p-1.5 rounded-lg border border-dashed border-white/15 bg-transparent flex flex-col items-center text-center">
                    <WaveformIcon type={w.type as any} size={22} className="w-5 h-5 text-slate-300" />
                    <span className="text-[11px] font-bold text-slate-200 font-mono">{w.name}</span>
                    <span className="text-[9px] text-slate-400 leading-tight">{w.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {(st.extra === 'ampEnv' || st.extra === 'filterEnv') && (
            <div className="p-2 rounded-lg bg-black/50 border border-amber-500/30 max-w-md">
              <span className="text-[10px] font-mono text-amber-300 font-bold block mb-1 uppercase tracking-wide">
                {st.extra === 'ampEnv' ? 'Your Amp EG' : 'Your Filter EG'}
              </span>
              <AdsrVisualizer
                attack={st.extra === 'ampEnv' ? params.ampAttack : params.modAttack}
                decay={st.extra === 'ampEnv' ? params.ampDecay : params.modDecay}
                sustain={st.extra === 'ampEnv' ? params.ampSustain : params.modSustain}
                release={st.extra === 'ampEnv' ? params.ampRelease : params.modRelease}
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
            {st.missions.map((m, i) => {
              const isDone = i < md;
              const isCurrent = i === md;
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
              onClick={active ? listen : undefined}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 active:scale-95 transition-all ${
                right ? 'bg-amber-400 hover:bg-amber-300 text-black animate-pulse' : 'bg-amber-500 hover:bg-amber-400 text-black'
              }`}
            >
              <Volume2 className="w-4 h-4" />
              {active && isPlaying ? 'Playing…' : 'Listen'}
            </button>
            <span className="text-[11px] font-mono text-slate-400">
              {complete
                ? 'Step done!'
                : right
                ? 'Settings look right. Now listen to it!'
                : 'Change the setting, then listen (or play the keys).'}
            </span>
          </div>
        </div>
      </div>
      </div>
    );
  };

  return (
    <div id="mode-learn-overlay" className="rounded-xl bg-gradient-to-r from-amber-950/70 via-slate-900 to-indigo-950/70 p-4 border border-amber-500/40 shadow-2xl text-slate-100">
      <div className="grid">{LEARN_STEPS.map((_, i) => renderStep(i, i === stepIdx))}</div>

      {/* Jump to any step you've reached: numbers plus short topic names */}
      <div className="flex flex-wrap items-center gap-1 mt-3 pt-2 border-t border-white/10" role="group" aria-label="Learn steps">
        {LEARN_STEPS.map((st, i) => {
          const complete = done[i] >= st.missions.length;
          const current = i === stepIdx;
          return (
            <button
              key={i}
              type="button"
              disabled={!reachable(i)}
              onClick={() => goTo(i)}
              title={`${i + 1}. ${st.title}${reachable(i) ? '' : ' (finish the earlier steps first)'}`}
              aria-current={current ? 'step' : undefined}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono leading-4 border flex items-center gap-1 transition-colors disabled:opacity-35 disabled:cursor-not-allowed ${
                current
                  ? 'bg-amber-400 text-black border-amber-300 font-bold'
                  : complete
                  ? 'bg-emerald-500/10 text-emerald-200 border-emerald-500/40 hover:bg-emerald-500/20'
                  : 'bg-black/30 text-slate-300 border-white/10 hover:bg-white/10'
              }`}
            >
              <span className={current ? '' : complete ? 'text-emerald-300' : 'text-slate-500'}>{complete && !current ? '✓' : i + 1}</span>
              {SHORT_TITLES[i] ?? st.title}
            </button>
          );
        })}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-2 text-xs">
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


        <div className="flex items-center gap-2">
        {/* End of Learn: a direct way into the challenges (first assigned one, usually A/B Ear Training) */}
        {stepIdx === LEARN_STEPS.length - 1 && (stepComplete || allDone) && (
          <button
            type="button"
            onClick={onGoToChallenges}
            className="px-4 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-black font-bold flex items-center gap-1.5 animate-pulse"
          >
            <Trophy className="w-4 h-4" />
            Start Challenges
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          type="button"
          disabled={!stepComplete && !allDone}
          onClick={() => (stepIdx === LEARN_STEPS.length - 1 ? setFinished(true) : goTo(stepIdx + 1))}
          className={`px-4 py-1.5 rounded font-bold flex items-center gap-1 transition-all ${
            stepComplete || allDone ? 'bg-amber-400 hover:bg-amber-300 text-black' : 'bg-slate-800 text-slate-500 cursor-not-allowed'
          }`}
        >
          <span>{stepIdx === LEARN_STEPS.length - 1 ? 'Finish' : 'Next Step'}</span>
          <ChevronRight className="w-4 h-4" />
        </button>
        </div>
      </div>
    </div>
  );
};
