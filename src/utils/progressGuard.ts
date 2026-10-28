import { StudentSubmission, BriefWork } from '../types';
import { learnSummary } from './learnProgress';

/**
 * A short fingerprint of the student's progress. Compared against the fingerprint taken when they last made
 * a code, it tells us whether anything would be lost if the page closed. Nothing is stored anywhere.
 */
export function progressSignature(tasks: StudentSubmission['completedTasks'], briefs: Record<string, BriefWork>): string {
  const t = [...tasks].map((x) => `${x.taskId}:${Math.round(x.score)}:${x.tries ?? 0}`).sort();
  const b = Object.keys(briefs).sort().map((k) => `${k}:${JSON.stringify(briefs[k])}`);
  return JSON.stringify([t, b, learnSummary().done]);
}

export const hasProgress = (tasks: unknown[], briefs: Record<string, unknown>): boolean =>
  tasks.length > 0 || Object.keys(briefs).length > 0 || learnSummary().done > 0;
