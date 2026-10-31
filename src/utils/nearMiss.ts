import { SynthDoctorTicket, SynthParams } from '../types';

/** A Synth Doctor fix counts as "close" when what's left is this share of the original bug's distance. */
export const CLOSE_SHARE = 0.15;

/** Patch Master: a match is this score or better, and this far down counts as "so close". */
export const MATCH_SCORE = 80;
export const CLOSE_SCORE = 70;

/** Cutoff is heard in octaves, so its distances are measured on a log scale. */
const LOG_PARAMS: (keyof SynthParams)[] = ['filterCutoff'];

/**
 * For a Synth Doctor ticket that is not fixed yet: has the student moved the right control to just
 * short of (or just past) the fix? Returns which way to nudge it, or null when it's not close.
 *
 * "Close" is measured against the original bug: if the broken value was far from the target and the
 * student has covered most of that distance, they're close. A control they never touched stays
 * at the broken value, so it never counts.
 */
export function doctorNearMiss(ticket: SynthDoctorTicket, current: SynthParams): 'further' | 'back' | null {
  const value = current[ticket.paramKey];
  const broken = ticket.brokenParams[ticket.paramKey];
  if (typeof value !== 'number' || typeof broken !== 'number') return null;
  if (value === broken) return null; // never touched
  if (ticket.targetMin === undefined && ticket.targetMax === undefined) return null;

  const lo = ticket.targetMin ?? -Infinity;
  const hi = ticket.targetMax ?? Infinity;
  if (value >= lo && value <= hi) return null; // fixed, not a near miss

  const f = LOG_PARAMS.includes(ticket.paramKey) ? (n: number) => Math.log(Math.max(n, 1e-6)) : (n: number) => n;
  const bound = value < lo ? lo : hi;
  const away = f(value) - f(bound);
  const journey = f(broken) - f(bound);
  if (journey === 0) return null;

  // Whole-step controls (like Octave): one step away is close.
  const stepped = Number.isInteger(value) && Number.isInteger(broken) && Number.isInteger(bound);
  const isClose = stepped ? Math.abs(away) <= 1 : Math.abs(away) / Math.abs(journey) <= CLOSE_SHARE;
  if (!isClose) return null;

  // Still on the broken side of the target: push further. Already past it: ease back.
  return away * journey > 0 ? 'further' : 'back';
}
