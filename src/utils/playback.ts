import { SynthParams, PhraseId, PhraseNote } from '../types';
import { SubtractiveEngine } from '../audio/synthEngine';

export type { PhraseNote };

/** Notes one after another, `step` seconds apart, each `dur` long. */
export const seq = (notes: string[], step: number, dur: number, start = 0): PhraseNote[] =>
  notes.map((note, i) => ({ note, at: start + i * step, dur }));
/** Notes together as a chord. */
export const chord = (notes: string[], at: number, dur: number): PhraseNote[] => notes.map((note) => ({ note, at, dur }));

/** Short musical contexts for hearing a patch the way it would be used. */
export const PHRASES: Record<PhraseId, { label: string; notes: PhraseNote[] }> = {
  bassRiff: {
    label: 'Bass riff',
    notes: [
      { note: 'C2', at: 0, dur: 0.9 },
      { note: 'C2', at: 1.0, dur: 0.35 },
      { note: 'D#2', at: 1.5, dur: 0.35 },
      { note: 'F2', at: 2.0, dur: 0.35 },
      { note: 'G2', at: 2.5, dur: 1.1 },
    ],
  },
  padChords: {
    label: 'Two chords',
    notes: [...chord(['C3', 'E3', 'G3', 'B3'], 0, 2.4), ...chord(['A2', 'C3', 'E3', 'G3'], 2.6, 2.6)],
  },
  leadLine: {
    label: 'Melody',
    notes: [
      { note: 'E4', at: 0, dur: 0.3 },
      { note: 'G4', at: 0.35, dur: 0.3 },
      { note: 'A4', at: 0.7, dur: 0.6 },
      { note: 'G4', at: 1.35, dur: 0.3 },
      { note: 'E4', at: 1.7, dur: 0.3 },
      { note: 'D4', at: 2.05, dur: 1.0 },
    ],
  },
  pluckArp: {
    label: 'Arpeggio',
    notes: seq(['C4', 'E4', 'G4', 'C5', 'G4', 'E4', 'C4', 'E4', 'G4', 'C5'], 0.18, 0.14),
  },
  longHit: { label: 'One long note', notes: [{ note: 'C3', at: 0, dur: 2.0 }] },
  shortHits: { label: 'Short notes', notes: seq(['C5', 'G5', 'C5', 'E5', 'G5', 'C6'], 0.22, 0.1) },
  swell: { label: 'Long held note', notes: [{ note: 'C3', at: 0, dur: 5.0 }] },
  drumBeat: {
    label: 'Drum pattern',
    notes: [0, 0.5, 1.0, 1.25, 1.5, 2.0, 2.5, 2.75, 3.0].map((at) => ({ note: 'C3', at, dur: 0.1 })),
  },
};

/** Notes at chosen times: [note, start, length] triples. */
export const at = (...items: [string, number, number][]): PhraseNote[] => items.map(([note, t, dur]) => ({ note, at: t, dur }));

let stopCurrent: (() => void) | null = null;
/** Bumped by every new phrase, so a stale "put the patch back" never lands mid-phrase. */
let generation = 0;
/** The phrase loop that is running, if any (only one at a time). */
let activeLoop: { stop: () => void } | null = null;

/** Stop whatever phrase or loop is playing (and put the student's own patch back). */
export function stopPhrase() {
  activeLoop?.stop();
  stopCurrent?.();
  stopCurrent = null;
}

/**
 * Repeat a phrase until stopped, with a short gap between passes. Every pass starts fresh notes on
 * the engine's current patch, so knob changes are heard on the very next note: this is for
 * tweaking a sound while it plays. Starting any other phrase (or calling stopPhrase) ends the loop.
 * Returns a function that stops the loop; `onStop` fires however the loop ends.
 */
export function loopPhrase(
  engine: SubtractiveEngine,
  notes: PhraseNote[],
  opts: { gap?: number; onStop?: () => void } = {}
): () => void {
  stopPhrase();
  const gap = opts.gap ?? 0.5;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopInner: () => void = () => {};

  const loop = {
    stop: () => {
      if (stopped) return;
      stopped = true;
      clearTimeout(timer);
      if (activeLoop === loop) activeLoop = null;
      stopInner();
      opts.onStop?.();
    },
  };
  activeLoop = loop;

  const pass = async () => {
    if (stopped) return;
    const stopThisPass = await playOnce(engine, notes, {
      onDone: () => {
        if (!stopped) timer = setTimeout(pass, gap * 1000);
      },
    });
    stopInner = stopThisPass;
    if (stopped) stopThisPass();
  };
  pass();
  return loop.stop;
}

/**
 * Play a phrase on the engine. With `params`, the phrase plays with that patch and the
 * student's own patch (from `restore`) comes back afterwards. Starting a new phrase
 * stops the previous one. Returns a function that stops this phrase.
 */
export async function playPhrase(
  engine: SubtractiveEngine,
  notes: PhraseNote[],
  opts: { params?: SynthParams; restore?: () => SynthParams; onDone?: () => void } = {}
): Promise<() => void> {
  stopPhrase();
  return playOnce(engine, notes, opts);
}

/** One pass of a phrase. Replaces any single phrase already sounding, but leaves a running loop alone. */
async function playOnce(
  engine: SubtractiveEngine,
  notes: PhraseNote[],
  opts: { params?: SynthParams; restore?: () => SynthParams; onDone?: () => void } = {}
): Promise<() => void> {
  stopCurrent?.();
  stopCurrent = null;
  const myGen = ++generation;
  await engine.startAudioContext();
  if (myGen !== generation) return () => {};
  const timers: ReturnType<typeof setTimeout>[] = [];
  const sounding = new Set<string>();
  let finished = false;

  if (opts.params) engine.applyParams(opts.params);

  const finish = () => {
    if (finished) return;
    finished = true;
    timers.forEach(clearTimeout);
    sounding.forEach((n) => engine.noteOff(n));
    sounding.clear();
    if (opts.params && opts.restore) {
      // Let the last release ring a moment before switching the patch back.
      const tail = Math.min(1.5, Math.max(0.05, opts.params.ampRelease));
      setTimeout(() => {
        if (myGen === generation) engine.applyParams(opts.restore!());
      }, tail * 1000);
    }
    opts.onDone?.();
  };

  for (const n of notes) {
    timers.push(
      setTimeout(() => {
        sounding.add(n.note);
        engine.noteOn(n.note, n.vel ?? 0.85);
      }, n.at * 1000)
    );
    timers.push(
      setTimeout(() => {
        sounding.delete(n.note);
        engine.noteOff(n.note);
      }, (n.at + n.dur) * 1000)
    );
  }
  const end = Math.max(0, ...notes.map((n) => n.at + n.dur));
  timers.push(setTimeout(finish, end * 1000 + 30));

  const stop = () => {
    if (stopCurrent === stop) stopCurrent = null;
    finish();
  };
  stopCurrent = stop;
  return stop;
}
