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
