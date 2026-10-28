import { LEARN_STEPS } from './learnSteps';

/**
 * Progress through the Learn walkthrough. It lives for this visit only (nothing is stored) and
 * survives switching tabs. The Grade Report reads it to show whether the student did Learn.
 */
export const learnProgress = {
  step: 0,
  started: false,
  /** Missions finished, per step. */
  done: LEARN_STEPS.map(() => 0),
  finished: false,
};

export interface LearnSummary {
  /** Steps with every mission finished. */
  done: number;
  total: number;
}

/** How many Learn steps are fully finished right now. */
export function learnSummary(): LearnSummary {
  return {
    done: LEARN_STEPS.filter((s, i) => (learnProgress.done[i] ?? 0) >= s.missions.length).length,
    total: LEARN_STEPS.length,
  };
}

/**
 * Put the walkthrough back to "the first `steps` steps are finished" (steps are done in order, and a code only
 * records how many were done). Never takes progress away.
 */
export function restoreLearnSteps(steps: number): void {
  const n = Math.max(0, Math.min(LEARN_STEPS.length, Math.round(steps)));
  if (!n) return;
  LEARN_STEPS.forEach((s, i) => {
    if (i < n) learnProgress.done[i] = Math.max(learnProgress.done[i] ?? 0, s.missions.length);
  });
  learnProgress.started = true; // don't reset the synth to step 1's sound when Learn opens
  learnProgress.step = Math.max(learnProgress.step, Math.min(n, LEARN_STEPS.length - 1));
}
