import { PhraseId } from '../types';
import { PhraseNote } from './playback';

/**
 * Shared pieces of the optional synth guides (Soundtrap, Logic Retro Synth): step and mission types,
 * tempo-synced LFO rates, and progress that is kept like Learn's (this visit, autosave and the code).
 */

/** Tempo-synced LFO rates, slowest to fastest. In a DAW they follow the song's tempo; here, 120 BPM. */
export const SYNC_DIVS: { label: string; beats: number }[] = [
  { label: '1/1', beats: 4 },
  { label: '1/2', beats: 2 },
  { label: '1/4.', beats: 1.5 },
  { label: '1/4', beats: 1 },
  { label: '1/8.', beats: 0.75 },
  { label: '1/4T', beats: 2 / 3 },
  { label: '1/8', beats: 0.5 },
  { label: '1/8T', beats: 1 / 3 },
  { label: '1/16', beats: 0.25 },
  { label: '1/16T', beats: 1 / 6 },
  { label: '1/32', beats: 0.125 },
];
export const GUIDE_BPM = 120;
/** The LFO rate in Hz for a SYNC_DIVS index. */
export const divHz = (i: number) => 1 / ((SYNC_DIVS[Math.max(0, Math.min(SYNC_DIVS.length - 1, Math.round(i)))].beats * 60) / GUIDE_BPM);

export interface GuideMission<P> {
  text: string;
  check: (p: P) => boolean;
}

export interface GuideStep<P> {
  title: string;
  short: string;
  /** Panel sections to glow. */
  sections: string[];
  /** Parts of the signal-path diagram to light up. */
  flow: string[];
  what: string;
  listen: string;
  start: Partial<P>;
  phrase: PhraseNote[];
  missions: GuideMission<P>[];
  extra?: 'names';
}

export interface GuideStartingPoint<P> {
  name: string;
  what: string;
  phrase: PhraseId;
  /** Semitones to move the phrase (so it sits where the sound works best). */
  transpose?: number;
  patch: Partial<P>;
}

/** SynthLab name → the other synth's name, for a guide's first step. */
export interface NameRow {
  synthlab: string;
  theirs: string;
  note?: string;
}

export const one = (note: string, dur: number, at = 0): PhraseNote => ({ note, at, dur });
export const run = (notes: string[], step: number, dur: number): PhraseNote[] => notes.map((n, i) => one(n, dur, i * step));

export interface GuideProgress {
  step: number;
  started: boolean;
  done: number[];
  finished: boolean;
}

/** Progress for one guide, plus the helpers the code and autosave use. */
export function makeGuideProgress(steps: { missions: unknown[] }[]) {
  const progress: GuideProgress = { step: 0, started: false, done: steps.map(() => 0), finished: false };
  return {
    progress,
    summary(): { done: number; total: number } {
      return { done: steps.filter((s, i) => (progress.done[i] ?? 0) >= s.missions.length).length, total: steps.length };
    },
    /** From a code: the first `n` steps are finished. Never takes progress away. */
    restoreSteps(n: number): void {
      const k = Math.max(0, Math.min(steps.length, Math.round(n)));
      if (!k) return;
      steps.forEach((s, i) => {
        if (i < k) progress.done[i] = Math.max(progress.done[i] ?? 0, s.missions.length);
      });
      progress.step = Math.max(progress.step, Math.min(k, steps.length - 1));
    },
    snapshot(): number[] {
      return [...progress.done];
    },
    /** From autosave: exact mission counts per step. Never takes progress away. */
    restoreDone(done: number[] | undefined): void {
      if (!Array.isArray(done)) return;
      let any = false;
      steps.forEach((s, i) => {
        const n = Math.max(0, Math.min(s.missions.length, Math.round(Number(done[i]) || 0)));
        if (n > 0) {
          progress.done[i] = Math.max(progress.done[i] ?? 0, n);
          any = true;
        }
      });
      if (!any) return;
      const firstOpen = steps.findIndex((s, i) => (progress.done[i] ?? 0) < s.missions.length);
      progress.step = Math.max(progress.step, firstOpen === -1 ? steps.length - 1 : firstOpen);
    },
  };
}
