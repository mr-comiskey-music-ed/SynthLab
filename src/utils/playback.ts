import { SynthParams, PhraseId } from '../types';
import { SubtractiveEngine } from '../audio/synthEngine';

/** One note in a test phrase. Times are in seconds. */
export interface PhraseNote {
  note: string;
  at: number;
  dur: number;
  vel?: number;
}

const seq = (notes: string[], step: number, dur: number, start = 0): PhraseNote[] =>
  notes.map((note, i) => ({ note, at: start + i * step, dur }));
const chord = (notes: string[], at: number, dur: number): PhraseNote[] => notes.map((note) => ({ note, at, dur }));

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
};

/** A phrase from a list of note names: one after another, or all together as a chord. */
export function notesPhrase(notes: string[], noteLength: number, asChord = false): PhraseNote[] {
  return asChord ? chord(notes, 0, noteLength * 1.6) : seq(notes, noteLength, noteLength * 0.8);
}

let stopCurrent: (() => void) | null = null;
/** Bumped by every new phrase, so a stale "put the patch back" never lands mid-phrase. */
let generation = 0;

/** Stop whatever phrase is playing (and put the student's own patch back). */
export function stopPhrase() {
  stopCurrent?.();
  stopCurrent = null;
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
