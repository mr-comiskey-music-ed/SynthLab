import { PATCH_MATCHER_CHALLENGES, SYNTH_DOCTOR_TICKETS, BLIND_TEST_CHALLENGES } from './presets';
import { SOUND_BRIEFS } from './briefs';
import { MY_PRESET_SLOTS } from './myPresets';

/**
 * Every gradeable task in the lab, in one place. Submission codes only carry
 * task IDs and scores; titles and categories are rebuilt from this list.
 */

export type TaskCategory = 'Patch Matcher' | 'Synth Doctor' | 'Blind Ear Test' | 'Sound Design' | 'My Presets';

export interface TaskInfo {
  id: string;
  title: string; // same wording the Challenges tab records
  shortTitle: string;
  category: TaskCategory;
}

export const TASK_CATEGORIES: TaskCategory[] = ['Blind Ear Test', 'Synth Doctor', 'My Presets', 'Sound Design', 'Patch Matcher'];

const TASKS_UNSORTED: TaskInfo[] = [
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
  ...SOUND_BRIEFS.map((b) => ({
    id: b.id,
    title: `Sound Design: ${b.title}`,
    shortTitle: `${b.title} (${b.kind})`,
    category: 'Sound Design' as const,
  })),
  ...MY_PRESET_SLOTS.map((s) => ({
    id: s.id,
    title: `My Presets: ${s.title}`,
    shortTitle: s.title,
    category: 'My Presets' as const,
  })),
];

/** Listed in quest order: Ear Training, Synth Doctor, My Presets, Sound Design, Patch Master. */
export const ALL_TASKS: TaskInfo[] = [...TASKS_UNSORTED].sort(
  (a, b) => TASK_CATEGORIES.indexOf(a.category) - TASK_CATEGORIES.indexOf(b.category)
);

/** With no assignment, the grade is the average across all tasks. */
export const TOTAL_TASK_COUNT = ALL_TASKS.length;

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

/** The tasks a grade is out of: the assigned ones, or every task when nothing was assigned. */
export function gradedTaskIds(assigned?: string[]): string[] {
  return assigned && assigned.length ? assigned : ALL_TASKS.map((t) => t.id);
}

export interface DoneTask {
  taskId: string;
  score: number;
  /** Patch Master only: how many times the student pressed Test Match. */
  tries?: number;
}

export interface MainGrade {
  score: number; // 0-100
  done: number;
  total: number;
}

/** Best match % that earns the full "score" half of a Patch Master patch. */
export const PATCH_MASTER_FULL_MATCH = 85;

/**
 * Points for one Patch Master patch (0-100): 50 for trying it, plus up to 50 from
 * the best match score, scaled so a best match of 85% or more earns all 50.
 */
export function patchMasterPoints(best: number | undefined): number {
  if (best === undefined) return 0;
  return 50 + 50 * Math.min(1, Math.max(0, best) / PATCH_MASTER_FULL_MATCH);
}

export interface PatchMasterGrade {
  score: number; // average of patchMasterPoints over the assigned patches
  tried: number;
  total: number;
  avgBestMatch: number | null; // average best match % of the patches tried
  totalTries: number;
}

/** How many Sound Design Briefs a student must turn in to finish that quest. */
export const DESIGN_REQUIRED = 4;

/** Sound Design Briefs are graded by the teacher's ear; the app only counts what was turned in. */
export interface DesignProgress {
  submitted: number;
  total: number;
}

export interface Grades {
  /** A/B Ear Training + Synth Doctor. Null when none were assigned. */
  main: MainGrade | null;
  /** Patch Master: half for trying, half from match scores. Null when none were assigned. */
  patchMaster: PatchMasterGrade | null;
  /** Sound Design Briefs turned in. Null when none were assigned. */
  design: DesignProgress | null;
  /** My Presets turned in. Null when none were assigned. */
  myPresets: DesignProgress | null;
}

export const isPatchMaster = (id: string) => taskInfo(id)?.category === 'Patch Matcher';
export const isDesignBrief = (id: string) => taskInfo(id)?.category === 'Sound Design';
export const isMyPreset = (id: string) => taskInfo(id)?.category === 'My Presets';
/** Creative tasks: saved sounds the teacher grades by ear. */
export const isByEar = (id: string) => isDesignBrief(id) || isMyPreset(id);

/**
 * Grades, each out of the assigned tasks (or all tasks when nothing was assigned):
 *  - Main grade: average score on assigned Ear Training + Synth Doctor tasks
 *    (an unfinished task counts as 0).
 *  - Patch Master grade: average over assigned patches of 50 points for trying plus up
 *    to 50 more from the best match (85%+ = full points); untried patches get 0.
 *  - Sound Design: briefs turned in, out of the 4 required (the teacher grades them by ear).
 * Tasks done outside the assignment are shown but don't change any grade.
 */
export function gradesFor(tasks: DoneTask[], assigned?: string[]): Grades {
  const graded = gradedTaskIds(assigned);
  const byId = new Map(tasks.map((t) => [t.taskId, t]));
  const mainIds = graded.filter((id) => !isPatchMaster(id) && !isByEar(id));
  const briefIds = graded.filter(isDesignBrief);
  const myIds = graded.filter(isMyPreset);
  const pmIds = graded.filter(isPatchMaster);

  let main: MainGrade | null = null;
  if (mainIds.length) {
    const doneMain = mainIds.filter((id) => byId.has(id));
    const sum = doneMain.reduce((s, id) => s + (byId.get(id)!.score || 0), 0);
    main = { score: Math.round(sum / mainIds.length), done: doneMain.length, total: mainIds.length };
  }

  let patchMaster: PatchMasterGrade | null = null;
  if (pmIds.length) {
    const tried = pmIds.filter((id) => byId.has(id)).map((id) => byId.get(id)!);
    patchMaster = {
      score: Math.round(pmIds.reduce((s, id) => s + patchMasterPoints(byId.get(id)?.score), 0) / pmIds.length),
      tried: tried.length,
      total: pmIds.length,
      avgBestMatch: tried.length ? Math.round(tried.reduce((s, t) => s + t.score, 0) / tried.length) : null,
      totalTries: tried.reduce((s, t) => s + (t.tries || 1), 0),
    };
  }
  const designNeeded = Math.min(DESIGN_REQUIRED, briefIds.length);
  const design = briefIds.length
    ? { submitted: Math.min(designNeeded, briefIds.filter((id) => byId.has(id)).length), total: designNeeded }
    : null;
  const myPresets = myIds.length ? { submitted: myIds.filter((id) => byId.has(id)).length, total: myIds.length } : null;
  return { main, patchMaster, design, myPresets };
}

/** The headline number kept on a submission: the main grade, or the Patch Master grade if that's all that was assigned. */
export function headlineScore(g: Grades): number {
  return g.main?.score ?? g.patchMaster?.score ?? 0;
}

/** How many of the graded tasks are done. */
export function gradedDoneCount(tasks: { taskId: string }[], assigned?: string[]): number {
  const set = new Set(gradedTaskIds(assigned));
  return tasks.filter((t) => set.has(t.taskId)).length;
}

export function letterGrade(pct: number): string {
  return pct >= 90 ? 'A' : pct >= 80 ? 'B' : pct >= 70 ? 'C' : pct >= 60 ? 'D' : 'F';
}
