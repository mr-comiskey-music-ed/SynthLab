import { PATCH_MATCHER_CHALLENGES, SYNTH_DOCTOR_TICKETS, BLIND_TEST_CHALLENGES } from './presets';

/**
 * Every gradeable task in the lab, in one place. Submission codes only carry
 * task IDs and scores; titles and categories are rebuilt from this list.
 */

export type TaskCategory = 'Patch Matcher' | 'Synth Doctor' | 'Blind Ear Test';

export interface TaskInfo {
  id: string;
  title: string; // same wording the Challenges tab records
  shortTitle: string;
  category: TaskCategory;
}

export const TASK_CATEGORIES: TaskCategory[] = ['Patch Matcher', 'Synth Doctor', 'Blind Ear Test'];

export const ALL_TASKS: TaskInfo[] = [
  ...PATCH_MATCHER_CHALLENGES.map((c) => ({
    id: c.id,
    title: `Patch Matcher: ${c.title}`,
    shortTitle: c.title,
    category: 'Patch Matcher' as const,
  })),
  ...SYNTH_DOCTOR_TICKETS.map((t) => ({
    id: t.id,
    title: `Synth Doctor: #${t.ticketNumber} ${t.title}`,
    shortTitle: `#${t.ticketNumber} ${t.title}`,
    category: 'Synth Doctor' as const,
  })),
  ...BLIND_TEST_CHALLENGES.map((b) => ({
    id: b.id,
    title: `Blind Ear Test: ${b.question}`,
    shortTitle: b.question,
    category: 'Blind Ear Test' as const,
  })),
];

/** Grade is the average across all tasks; unfinished tasks count as 0. */
export const TOTAL_TASK_COUNT = 30;

const BY_ID = new Map(ALL_TASKS.map((t) => [t.id, t]));

export function taskInfo(id: string): TaskInfo | undefined {
  return BY_ID.get(id);
}

export function taskTitle(id: string): string {
  return BY_ID.get(id)?.title ?? id;
}

export function totalScoreFor(tasks: { score: number }[]): number {
  if (!tasks.length) return 0;
  return Math.round(tasks.reduce((sum, t) => sum + t.score, 0) / TOTAL_TASK_COUNT);
}

export function letterGrade(pct: number): string {
  return pct >= 90 ? 'A' : pct >= 80 ? 'B' : pct >= 70 ? 'C' : pct >= 60 ? 'D' : 'F';
}
