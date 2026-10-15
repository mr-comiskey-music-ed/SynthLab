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

/** With no assignment, the grade is the average across all tasks. */
export const TOTAL_TASK_COUNT = 30;

const BY_ID = new Map(ALL_TASKS.map((t) => [t.id, t]));

export function taskInfo(id: string): TaskInfo | undefined {
  return BY_ID.get(id);
}

export function taskTitle(id: string): string {
  return BY_ID.get(id)?.title ?? id;
}

/** Keep only real task IDs, in Challenges-tab order, without repeats. */
export function cleanTaskList(ids: string[] | undefined | null): string[] {
  const wanted = new Set((ids || []).map((s) => s.trim()));
  return ALL_TASKS.filter((t) => wanted.has(t.id)).map((t) => t.id);
}

/** The tasks a grade is out of: the assigned ones, or all 30 when nothing was assigned. */
export function gradedTaskIds(assigned?: string[]): string[] {
  return assigned && assigned.length ? assigned : ALL_TASKS.map((t) => t.id);
}

/**
 * Grade = average score across the graded tasks; an unfinished task counts as 0.
 * Tasks done outside the assignment are shown but don't change the grade.
 */
export function totalScoreFor(tasks: { taskId: string; score: number }[], assigned?: string[]): number {
  const graded = gradedTaskIds(assigned);
  const set = new Set(graded);
  const sum = tasks.filter((t) => set.has(t.taskId)).reduce((s, t) => s + t.score, 0);
  return Math.round(sum / graded.length);
}

/** How many of the graded tasks are done. */
export function gradedDoneCount(tasks: { taskId: string }[], assigned?: string[]): number {
  const set = new Set(gradedTaskIds(assigned));
  return tasks.filter((t) => set.has(t.taskId)).length;
}

export function letterGrade(pct: number): string {
  return pct >= 90 ? 'A' : pct >= 80 ? 'B' : pct >= 70 ? 'C' : pct >= 60 ? 'D' : 'F';
}
