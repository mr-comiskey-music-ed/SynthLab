import React, { useEffect, useId, useRef, useState } from 'react';
import * as Tone from 'tone';
import { SubtractiveEngine } from '../audio/synthEngine';
import { MiniSoundtrapPanel } from './SoundtrapView';
import { playPhrase, PHRASES } from '../utils/playback';
import {
  SoundtrapPatch,
  GUIDE_BASE,
  ST_STEPS,
  StFlow,
  StSection,
  NAME_MAP,
  STARTING_POINTS,
  soundtrapProgress as progress,
} from '../utils/soundtrap';
import { CheckCircle2, ChevronRight, ChevronLeft, Volume2, RotateCcw, Circle, Ear, Trophy, ArrowRight, BookOpen, Compass, Play } from 'lucide-react';

interface ModeSoundtrapProps {
  engine: SubtractiveEngine;
  patch: SoundtrapPatch;
  onLoadPatch: (p: SoundtrapPatch) => void;
  onHighlight: (sections: StSection[]) => void;
  onGoToChallenges: () => void;
  onBackToLearn: () => void;
}

const CAPTIONS: Record<StFlow, string> = {
  osc: 'Oscillators make the raw tone',
  hpf: 'HPF cuts the lows',
  filter: 'Filter cuts the highs',
  amp: 'Amp sets the loudness',
  chorus: 'Chorus widens it',
  env: 'One envelope moves the filter and the amp',
  lfo: 'LFO wobbles pitch, pulse width and cutoff',
};

/** Soundtrap's signal path: one envelope with two arrows (filter and amp) is the big difference from SynthLab. */
const SoundtrapFlow: React.FC<{ lit: StFlow[] }> = ({ lit }) => {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const mk = { flow: `st-flow-${uid}`, on: `st-on-${uid}`, off: `st-off-${uid}` };
  const on = (p: StFlow) => lit.includes(p);
  const FONT = "'Barlow Semi Condensed', 'Barlow', system-ui, sans-serif";
  const Block: React.FC<{ part: StFlow; x: number; y: number; w: number; h: number; label: string }> = ({ part, x, y, w, h, label }) => {
    const c = on(part)
      ? { fill: '#fbbf24', stroke: '#fde68a', text: '#111827' }
      : { fill: 'rgba(0,0,0,0.4)', stroke: 'rgba(255,255,255,0.14)', text: '#94a3b8' };
    return (
      <g style={on(part) ? { filter: 'drop-shadow(0 0 5px rgba(251,191,36,0.6))' } : undefined}>
        <rect x={x} y={y} width={w} height={h} rx={7} fill={c.fill} stroke={c.stroke} strokeWidth={1.5} />
        <text x={x + w / 2} y={y + h / 2 + 4} textAnchor="middle" fontSize={12} fontWeight={700} fill={c.text} fontFamily={FONT} letterSpacing="0.05em">
          {label}
        </text>
      </g>
    );
  };
  const mod = (p: StFlow) => (on(p) ? '#22d3ee' : 'rgba(148,163,184,0.45)');
  const sound = 'rgba(203,213,225,0.7)';
  const arrow = (p: StFlow) => `url(#${on(p) ? mk.on : mk.off})`;

  return (
    <div className="w-full md:flex-1 md:max-w-[46rem] min-w-0" aria-label="Soundtrap signal path">
      <svg viewBox="0 0 700 100" className="w-full h-auto block" role="img" aria-label="Oscillators go through the HPF, filter, amp and chorus to the speaker; one envelope moves both the filter and the amp, and the LFO moves pitch, pulse width and cutoff">
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

        <Block part="osc" x={0} y={14} w={128} h={30} label="OSCILLATORS" />
        <path d="M128 29 H158" stroke={sound} strokeWidth={1.5} markerEnd={`url(#${mk.flow})`} />
        <Block part="hpf" x={162} y={14} w={70} h={30} label="HPF" />
        <path d="M232 29 H262" stroke={sound} strokeWidth={1.5} markerEnd={`url(#${mk.flow})`} />
        <Block part="filter" x={266} y={14} w={100} h={30} label="FILTER" />
        <path d="M366 29 H396" stroke={sound} strokeWidth={1.5} markerEnd={`url(#${mk.flow})`} />
        <Block part="amp" x={400} y={14} w={86} h={30} label="AMP" />
        <path d="M486 29 H516" stroke={sound} strokeWidth={1.5} markerEnd={`url(#${mk.flow})`} />
        <Block part="chorus" x={520} y={14} w={100} h={30} label="CHORUS" />
        <path d="M620 29 H648" stroke={sound} strokeWidth={1.5} markerEnd={`url(#${mk.flow})`} />
        <text x={672} y={37} textAnchor="middle" fontSize={24}>🔊</text>

        <Block part="lfo" x={0} y={74} w={128} h={24} label="LFO" />
        <path d="M40 74 V46" fill="none" stroke={mod('lfo')} strokeWidth={1.75} strokeDasharray="4 3" markerEnd={arrow('lfo')} />
        <text x={46} y={62} fontSize={10} fill={mod('lfo')} fontFamily={FONT}>pitch · PWM</text>
        <path d="M120 74 V64 H300 V46" fill="none" stroke={mod('lfo')} strokeWidth={1.75} strokeDasharray="4 3" markerEnd={arrow('lfo')} />
        <text x={160} y={60} fontSize={10} fill={mod('lfo')} fontFamily={FONT}>cutoff</text>

        {/* One envelope, two jobs */}
        <Block part="env" x={318} y={74} w={150} h={24} label="ENVELOPE" />
        <path d="M340 74 V46" fill="none" stroke={mod('env')} strokeWidth={1.75} strokeDasharray="4 3" markerEnd={arrow('env')} />
        <text x={346} y={62} fontSize={10} fill={mod('env')} fontFamily={FONT}>cutoff</text>
        <path d="M446 74 V46" fill="none" stroke={mod('env')} strokeWidth={1.75} strokeDasharray="4 3" markerEnd={arrow('env')} />
        <text x={452} y={62} fontSize={10} fill={mod('env')} fontFamily={FONT}>volume</text>
      </svg>
    </div>
  );
};

/** Clear signpost: this is an extra, and the Challenges are where students go next. */
const ExtraBanner: React.FC<{ onGoToChallenges: () => void; onBackToLearn: () => void }> = ({ onGoToChallenges, onBackToLearn }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 px-3 py-2 rounded-lg bg-sky-500/10 border border-sky-400/30 text-xs">
    <span className="flex items-start gap-1.5 text-sky-100">
      <Compass className="w-4 h-4 shrink-0 text-sky-300 mt-px" />
      <span>
        <b>Extra guide: the Soundtrap synth.</b> Use it when you start making sounds in Soundtrap. It isn’t part of the main path: after
        Learn, your next stop is the <b>Challenges</b>.
      </span>
    </span>
    <span className="flex gap-1.5 shrink-0">
      <button type="button" onClick={onBackToLearn} className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 flex items-center gap-1">
        <BookOpen className="w-3.5 h-3.5" /> Learn
      </button>
      <button type="button" onClick={onGoToChallenges} className="px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-black font-bold flex items-center gap-1">
        Challenges <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </span>
  </div>
);

export const ModeSoundtrap: React.FC<ModeSoundtrapProps> = ({ engine, patch, onLoadPatch, onHighlight, onGoToChallenges, onBackToLearn }) => {
  const [stepIdx, setStepIdx] = useState(progress.step);
  const [done, setDone] = useState<number[]>(progress.done);
  const [finished, setFinished] = useState(progress.finished);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingPoint, setPlayingPoint] = useState<number | null>(null);
  const step = ST_STEPS[stepIdx];
  const stepComplete = done[stepIdx] >= step.missions.length;

  const patchRef = useRef(patch);
  patchRef.current = patch;
  const stateRef = useRef({ stepIdx, done, finished });
  stateRef.current = { stepIdx, done, finished };

  useEffect(() => {
    progress.step = stepIdx;
    progress.done = done;
    progress.finished = finished;
  }, [stepIdx, done, finished]);

  const loadStep = (idx: number) => onLoadPatch({ ...GUIDE_BASE, ...ST_STEPS[idx].start });

  useEffect(() => {
    if (!progress.started) {
      progress.started = true;
      loadStep(stepIdx);
    }
    return () => onHighlight([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    onHighlight(finished ? [] : step.sections);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx, finished]);

  // Same rule as Learn: a mission counts once its settings are right AND a note is heard with them.
  const lastAdvanceRef = useRef(0);
  useEffect(() => {
    return engine.subscribeEnvelope((isHeld) => {
      if (!isHeld || performance.now() - lastAdvanceRef.current < 400) return;
      const { stepIdx: i, done: d, finished: f } = stateRef.current;
      if (f) return;
      const m = ST_STEPS[i].missions[d[i]];
      if (!m || !m.check(patchRef.current)) return;
      lastAdvanceRef.current = performance.now();
      setDone((prev) => prev.map((n, j) => (j === i ? Math.min(ST_STEPS[i].missions.length, n + 1) : n)));
    });
  }, [engine]);

  const goTo = (idx: number) => {
    if (idx < 0 || idx >= ST_STEPS.length) return;
    setFinished(false);
    setStepIdx(idx);
    loadStep(idx);
  };

  const listen = async () => {
    setIsPlaying(true);
    await playPhrase(engine, step.phrase, { onDone: () => setIsPlaying(false) });
  };

  const tryPoint = async (i: number) => {
    const sp = STARTING_POINTS[i];
    onLoadPatch({ ...GUIDE_BASE, ...sp.patch });
    setPlayingPoint(i);
    // Let the new settings land before the first note.
    setTimeout(() => {
      const shift = sp.transpose ?? 0;
      const notes = PHRASES[sp.phrase].notes.map((n) => (shift ? { ...n, note: Tone.Frequency(n.note).transpose(shift).toNote() } : n));
      playPhrase(engine, notes, { onDone: () => setPlayingPoint((cur) => (cur === i ? null : cur)) });
    }, 60);
  };

  const firstUnfinished = done.findIndex((n, i) => n < ST_STEPS[i].missions.length);
  const allDone = firstUnfinished === -1;
  const reachable = (i: number) => allDone || i <= firstUnfinished;

  if (finished) {
    return (
      <div id="mode-soundtrap-panel" className="rounded-xl bg-gradient-to-r from-sky-950/70 via-slate-900 to-indigo-950/70 p-4 border border-sky-500/40 shadow-2xl text-slate-100 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-mono tracking-widest text-sky-300 uppercase font-bold">Soundtrap guide complete</span>
            <h3 className="text-lg font-bold text-white">You can find your way around the Soundtrap synth.</h3>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              Same ideas, new panel: one oscillator with waves to mix, two filters, one envelope doing two jobs, and an LFO you send
              wherever you want it. Below are a few starting points if you want one.
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

        <div className="border-t border-white/10 pt-3">
          <span className="text-[10px] font-mono tracking-widest text-amber-300 uppercase font-bold">Settings to try</span>
          <p className="text-xs text-slate-300 mb-2 max-w-3xl">
            Five starting points. Hear one here, copy the settings into Soundtrap, then change things until it sounds like <i>yours</i>. A
            starting point is a place to begin, not the finished sound.
          </p>
          <div className="flex flex-col gap-2">
            {STARTING_POINTS.map((sp, i) => (
              <div key={sp.name} className="rounded-lg bg-black/40 border border-white/10 p-2.5 flex flex-col gap-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-white leading-tight">{sp.name}</h4>
                    <p className="text-[11px] text-slate-400 leading-snug">{sp.what}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => tryPoint(i)}
                    className="shrink-0 px-2 py-1 rounded bg-amber-500 hover:bg-amber-400 text-black text-[11px] font-bold flex items-center gap-1"
                    title="Put these settings on the practice synth below and play them"
                  >
                    <Play className="w-3 h-3" /> {playingPoint === i ? 'Playing…' : 'Hear it'}
                  </button>
                </div>
                <MiniSoundtrapPanel patch={{ ...GUIDE_BASE, ...sp.patch }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const renderStep = (i: number, active: boolean) => {
    const st = ST_STEPS[i];
    const md = done[i];
    const cur = st.missions[md];
    const right = active && cur ? cur.check(patch) : false;
    const complete = md >= st.missions.length;
    return (
      <div key={i} className={`[grid-area:1/1] min-w-0 ${active ? '' : 'invisible pointer-events-none'}`} aria-hidden={!active} inert={!active}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-sky-500/20 pb-3 mb-3">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-sky-400 text-black font-bold text-sm shrink-0">{i + 1}</span>
            <div>
              <span className="text-[10px] font-mono tracking-widest text-sky-300 uppercase font-bold">
                Soundtrap guide · Step {i + 1} of {ST_STEPS.length}
              </span>
              <h3 className="text-lg font-bold text-white leading-tight">{st.title}</h3>
              <p className="text-[11px] font-mono text-sky-200/80 leading-snug mt-0.5">{st.flow.map((p) => CAPTIONS[p]).join('  ·  ')}</p>
            </div>
          </div>
          <SoundtrapFlow lit={st.flow} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1.25fr_1fr] gap-4">
          <div className="space-y-2.5 min-w-0">
            <p className="text-sm text-slate-200 leading-relaxed">{st.what}</p>
            <p className="text-xs text-sky-200 flex items-start gap-1.5">
              <Ear className="w-4 h-4 shrink-0 text-sky-300" />
              <span>
                <b>Listen for:</b> {st.listen}
              </span>
            </p>
            {st.extra === 'names' && (
              <div className="rounded-lg border border-white/10 overflow-hidden text-[11px]">
                <div className="grid grid-cols-2 bg-white/5 font-mono font-bold uppercase tracking-wider text-[10px] text-slate-400">
                  <span className="px-2 py-1">In SynthLab</span>
                  <span className="px-2 py-1">In Soundtrap</span>
                </div>
                {NAME_MAP.map((r) => (
                  <div key={r.synthlab + r.soundtrap} className="grid grid-cols-2 border-t border-white/5">
                    <span className="px-2 py-1 text-slate-300">{r.synthlab}</span>
                    <span className="px-2 py-1 text-white">
                      {r.soundtrap}
                      {r.note && <span className="block text-[10px] text-slate-400">{r.note}</span>}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-3 rounded-lg bg-black/40 border border-white/10 flex flex-col gap-2.5">
            <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider font-mono">Try it on the practice synth below</span>
            <ol className="space-y-1.5">
              {st.missions.map((m, j) => {
                const isDone = j < md;
                const isCurrent = j === md;
                return (
                  <li key={j} className={`flex items-start gap-2 text-xs ${isDone ? 'text-emerald-300' : isCurrent ? 'text-slate-100' : 'text-slate-500'}`}>
                    {isDone ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    ) : (
                      <Circle className={`w-4 h-4 shrink-0 ${isCurrent ? 'text-amber-400' : 'text-slate-600'}`} />
                    )}
                    <span>{m.text}</span>
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
                {complete ? 'Step done!' : right ? 'Settings look right. Now listen to it!' : 'Change the setting, then listen (or play the keys).'}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div id="mode-soundtrap-panel" className="rounded-xl bg-gradient-to-r from-sky-950/70 via-slate-900 to-indigo-950/70 p-4 border border-sky-500/40 shadow-2xl text-slate-100">
      <ExtraBanner onGoToChallenges={onGoToChallenges} onBackToLearn={onBackToLearn} />
      <div className="grid">{ST_STEPS.map((_, i) => renderStep(i, i === stepIdx))}</div>

      <div className="flex flex-wrap items-center gap-1 mt-3 pt-2 border-t border-white/10" role="group" aria-label="Soundtrap guide steps">
        {ST_STEPS.map((st, i) => {
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
                  ? 'bg-sky-400 text-black border-sky-300 font-bold'
                  : complete
                  ? 'bg-emerald-500/10 text-emerald-200 border-emerald-500/40 hover:bg-emerald-500/20'
                  : 'bg-black/30 text-slate-300 border-white/10 hover:bg-white/10'
              }`}
            >
              <span className={current ? '' : complete ? 'text-emerald-300' : 'text-slate-500'}>{complete && !current ? '✓' : i + 1}</span>
              {st.short}
            </button>
          );
        })}
      </div>

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
            title="Put this step's starting sound back on the practice synth"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset sound
          </button>
        </div>
        <button
          type="button"
          disabled={!stepComplete && !allDone}
          onClick={() => (stepIdx === ST_STEPS.length - 1 ? setFinished(true) : goTo(stepIdx + 1))}
          className={`px-4 py-1.5 rounded font-bold flex items-center gap-1 transition-all ${
            stepComplete || allDone ? 'bg-sky-400 hover:bg-sky-300 text-black' : 'bg-slate-800 text-slate-500 cursor-not-allowed'
          }`}
        >
          <span>{stepIdx === ST_STEPS.length - 1 ? 'Finish' : 'Next Step'}</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
