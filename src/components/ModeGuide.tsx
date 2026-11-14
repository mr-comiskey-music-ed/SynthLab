import React, { useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';
import { SubtractiveEngine } from '../audio/synthEngine';
import { playPhrase, PHRASES } from '../utils/playback';
import { GuideProgress, GuideStartingPoint, GuideStep, NameRow } from '../utils/guides';
import { CheckCircle2, ChevronRight, ChevronLeft, Volume2, RotateCcw, Circle, Ear, Trophy, ArrowRight, BookOpen, Compass, Play } from 'lucide-react';

/** Everything that makes one synth guide (Soundtrap, Retro Synth) different; the screen itself is shared. */
export interface GuideDef<P> {
  /** For ids and labels: 'soundtrap' | 'retro'. */
  id: string;
  /** "Soundtrap guide", shown above each step. */
  label: string;
  /** "the Soundtrap synth", for the banner. */
  synthName: string;
  /** Where students will use it: "Soundtrap", "Logic". */
  appName: string;
  base: P;
  steps: GuideStep<P>[];
  nameMap: NameRow[];
  /** Column heading for the other synth's names in step 1. */
  theirsHeading: string;
  startingPoints: GuideStartingPoint<P>[];
  progress: GuideProgress;
  /** One caption per signal-path part. */
  captions: Record<string, string>;
  /** The signal-path diagram, with the step's parts lit. */
  Flow: React.FC<{ lit: string[] }>;
  /** A small read-only copy of the panel, for the Settings to try. */
  Mini: React.FC<{ patch: P }>;
  complete: { title: string; blurb: string };
}

interface ModeGuideProps<P> {
  guide: GuideDef<P>;
  engine: SubtractiveEngine;
  patch: P;
  onLoadPatch: (p: P) => void;
  onHighlight: (sections: string[]) => void;
  onGoToChallenges: () => void;
  onBackToLearn: () => void;
}

/** Clear signpost: this is an extra, and the Challenges are where students go next. */
const ExtraBanner: React.FC<{ synthName: string; appName: string; onGoToChallenges: () => void; onBackToLearn: () => void }> = ({
  synthName,
  appName,
  onGoToChallenges,
  onBackToLearn,
}) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 px-3 py-2 rounded-lg bg-sky-500/10 border border-sky-400/30 text-xs">
    <span className="flex items-start gap-1.5 text-sky-100">
      <Compass className="w-4 h-4 shrink-0 text-sky-300 mt-px" />
      <span>
        <b>Extra guide: {synthName}.</b> Use it when you start making sounds in {appName}. It isn’t part of the main path: after
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

export function ModeGuide<P>({ guide, engine, patch, onLoadPatch, onHighlight, onGoToChallenges, onBackToLearn }: ModeGuideProps<P>) {
  const { steps, progress, base, Flow, Mini } = guide;
  const [stepIdx, setStepIdx] = useState(progress.step);
  const [done, setDone] = useState<number[]>(progress.done);
  const [finished, setFinished] = useState(progress.finished);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingPoint, setPlayingPoint] = useState<number | null>(null);
  const step = steps[stepIdx];
  const stepComplete = done[stepIdx] >= step.missions.length;

  const patchRef = useRef(patch);
  patchRef.current = patch;
  const stateRef = useRef({ stepIdx, done, finished });
  stateRef.current = { stepIdx, done, finished };

  useEffect(() => {
    progress.step = stepIdx;
    progress.done = done;
    progress.finished = finished;
  }, [progress, stepIdx, done, finished]);

  const loadStep = (idx: number) => onLoadPatch({ ...base, ...steps[idx].start });

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
      const m = steps[i].missions[d[i]];
      if (!m || !m.check(patchRef.current)) return;
      lastAdvanceRef.current = performance.now();
      setDone((prev) => prev.map((n, j) => (j === i ? Math.min(steps[i].missions.length, n + 1) : n)));
    });
  }, [engine, steps]);

  const goTo = (idx: number) => {
    if (idx < 0 || idx >= steps.length) return;
    setFinished(false);
    setStepIdx(idx);
    loadStep(idx);
  };

  const listen = async () => {
    setIsPlaying(true);
    await playPhrase(engine, step.phrase, { onDone: () => setIsPlaying(false) });
  };

  const tryPoint = async (i: number) => {
    const sp = guide.startingPoints[i];
    onLoadPatch({ ...base, ...sp.patch });
    setPlayingPoint(i);
    // Let the new settings land before the first note.
    setTimeout(() => {
      const shift = sp.transpose ?? 0;
      const notes = PHRASES[sp.phrase].notes.map((n) => (shift ? { ...n, note: Tone.Frequency(n.note).transpose(shift).toNote() } : n));
      playPhrase(engine, notes, { onDone: () => setPlayingPoint((cur) => (cur === i ? null : cur)) });
    }, 60);
  };

  const firstUnfinished = done.findIndex((n, i) => n < steps[i].missions.length);
  const allDone = firstUnfinished === -1;
  const reachable = (i: number) => allDone || i <= firstUnfinished;
  const panelId = `mode-${guide.id}-panel`;

  if (finished) {
    return (
      <div id={panelId} className="rounded-xl bg-gradient-to-r from-sky-950/70 via-slate-900 to-indigo-950/70 p-4 border border-sky-500/40 shadow-2xl text-slate-100 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-mono tracking-widest text-sky-300 uppercase font-bold">{guide.label} complete</span>
            <h3 className="text-lg font-bold text-white">{guide.complete.title}</h3>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">{guide.complete.blurb}</p>
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
            Five starting points. Hear one here, copy the settings into {guide.appName}, then change things until it sounds like <i>yours</i>.
            A starting point is a place to begin, not the finished sound.
          </p>
          <div className="flex flex-col gap-2">
            {guide.startingPoints.map((sp, i) => (
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
                <Mini patch={{ ...base, ...sp.patch }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const renderStep = (i: number, active: boolean) => {
    const st = steps[i];
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
                {guide.label} · Step {i + 1} of {steps.length}
              </span>
              <h3 className="text-lg font-bold text-white leading-tight">{st.title}</h3>
              <p className="text-[11px] font-mono text-sky-200/80 leading-snug mt-0.5">{st.flow.map((p) => guide.captions[p]).join('  ·  ')}</p>
            </div>
          </div>
          <Flow lit={st.flow} />
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
                  <span className="px-2 py-1">{guide.theirsHeading}</span>
                </div>
                {guide.nameMap.map((r) => (
                  <div key={r.synthlab + r.theirs} className="grid grid-cols-2 border-t border-white/5">
                    <span className="px-2 py-1 text-slate-300">{r.synthlab}</span>
                    <span className="px-2 py-1 text-white">
                      {r.theirs}
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
    <div id={panelId} className="rounded-xl bg-gradient-to-r from-sky-950/70 via-slate-900 to-indigo-950/70 p-4 border border-sky-500/40 shadow-2xl text-slate-100">
      <ExtraBanner synthName={guide.synthName} appName={guide.appName} onGoToChallenges={onGoToChallenges} onBackToLearn={onBackToLearn} />
      <div className="grid">{steps.map((_, i) => renderStep(i, i === stepIdx))}</div>

      <div className="flex flex-wrap items-center gap-1 mt-3 pt-2 border-t border-white/10" role="group" aria-label={`${guide.label} steps`}>
        {steps.map((st, i) => {
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
          onClick={() => (stepIdx === steps.length - 1 ? setFinished(true) : goTo(stepIdx + 1))}
          className={`px-4 py-1.5 rounded font-bold flex items-center gap-1 transition-all ${
            stepComplete || allDone ? 'bg-sky-400 hover:bg-sky-300 text-black' : 'bg-slate-800 text-slate-500 cursor-not-allowed'
          }`}
        >
          <span>{stepIdx === steps.length - 1 ? 'Finish' : 'Next Step'}</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
