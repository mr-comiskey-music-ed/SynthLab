import { StudentSubmission, SynthParams } from '../types';
import { decodeSubmission } from './submissionCodec';
import { ALL_TASKS, TASK_CATEGORIES, TaskCategory, letterGrade, taskInfo, gradedTaskIds, gradedDoneCount, gradesFor, Grades, isDesignBrief } from './taskCatalog';

/** A Patch Matcher score under this counts as "lost points" in class patterns. */
export const STRUGGLE_THRESHOLD = 70;

export interface CategorySummary {
  done: number;
  total: number;
  average: number; // average score of the tasks this student did in the category
}

export interface BatchEntry {
  id: number;
  submission: StudentSubmission;
  patchParams?: SynthParams;
  grades: Grades;
  /** Letter for the main grade (Ear Training + Synth Doctor); '' when not assigned. */
  letter: string;
  categories: Record<TaskCategory, CategorySummary>;
  /** True when the same student name appears with more than one different code. */
  hasMultipleSubmissions: boolean;
}

export interface BatchParseResult {
  entries: BatchEntry[];
  unreadable: string[]; // the name on that line, or a short preview of the code
  duplicatesRemoved: number;
}

// New codes are <compressed>.<checksum>; older codes are one long base64 run.
const LOOKS_LIKE_CODE = /^[A-Za-z0-9_-]{20,}\.[a-z0-9]{1,8}$/;
const LONG_TOKEN = 30;

/** Category counts, out of the tasks this student was assigned. */
function summarize(sub: StudentSubmission): Record<TaskCategory, CategorySummary> {
  const out = {} as Record<TaskCategory, CategorySummary>;
  const graded = new Set(gradedTaskIds(sub.assignedTasks));
  for (const cat of TASK_CATEGORIES) {
    const total = ALL_TASKS.filter((t) => t.category === cat && graded.has(t.id)).length;
    const scores = sub.completedTasks
      .filter((t) => graded.has(t.taskId) && taskInfo(t.taskId)?.category === cat)
      .map((t) => t.score);
    out[cat] = {
      done: scores.length,
      total,
      average: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
    };
  }
  return out;
}

/**
 * Pull every submission code out of pasted text (a column from Classroom or a
 * spreadsheet, one per line, comma-separated, mixed with names...), then
 * decode each one.
 */
export async function parseBatch(text: string): Promise<BatchParseResult> {
  const seen = new Set<string>();
  const jobs: { token: string; label: string }[] = [];
  let duplicatesRemoved = 0;

  for (const line of text.split(/\r?\n/)) {
    const tokens = line.split(/[\s,;"'|]+/).filter(Boolean);
    const candidates = tokens.filter((t) => LOOKS_LIKE_CODE.test(t) || t.length >= LONG_TOKEN);
    // The rest of the line (usually the student's name) labels a code that can't be read.
    const label = tokens.filter((t) => !candidates.includes(t)).join(' ').slice(0, 40);
    for (const token of candidates) {
      if (seen.has(token)) {
        duplicatesRemoved++;
        continue;
      }
      seen.add(token);
      jobs.push({ token, label });
    }
  }

  const decoded = await Promise.all(jobs.map((j) => decodeSubmission(j.token)));
  const unreadable: string[] = [];
  const entries: BatchEntry[] = [];
  decoded.forEach((d, i) => {
    const { token, label } = jobs[i];
    if (!d) {
      unreadable.push(label || `code starting ${token.slice(0, 10)}… ending …${token.slice(-6)}`);
      return;
    }
    entries.push({
      id: entries.length,
      submission: d.submission,
      patchParams: d.patchParams,
      grades: gradesFor(d.submission.completedTasks, d.submission.assignedTasks),
      letter: '',
      categories: summarize(d.submission),
      hasMultipleSubmissions: false,
    });
  });

  for (const e of entries) e.letter = e.grades.main ? letterGrade(e.grades.main.score) : '';

  const nameCounts = new Map<string, number>();
  const key = (e: BatchEntry) => e.submission.studentName.trim().toLowerCase();
  for (const e of entries) nameCounts.set(key(e), (nameCounts.get(key(e)) || 0) + 1);
  for (const e of entries) e.hasMultipleSubmissions = key(e) !== '' && (nameCounts.get(key(e)) || 0) > 1;

  return { entries, unreadable, duplicatesRemoved };
}

export interface ClassPattern {
  taskId: string;
  title: string;
  category: TaskCategory;
  attempted: number;
  struggled: number; // attempted but wrong / not fixed / under the threshold
}

/** Tasks ranked by how many of the students who tried them lost points. */
export function classPatterns(entries: BatchEntry[]): ClassPattern[] {
  // Sound Design Briefs are graded by ear, so they never count as "lost points".
  return ALL_TASKS.filter((t) => !isDesignBrief(t.id)).map((t) => {
    let attempted = 0;
    let struggled = 0;
    for (const e of entries) {
      if (!gradedTaskIds(e.submission.assignedTasks).includes(t.id)) continue;
      const done = e.submission.completedTasks.find((c) => c.taskId === t.id);
      if (!done) continue;
      attempted++;
      if (done.score < STRUGGLE_THRESHOLD) struggled++;
    }
    return { taskId: t.id, title: t.shortTitle, category: t.category, attempted, struggled };
  })
    .filter((p) => p.struggled > 0)
    .sort((a, b) => b.struggled / b.attempted - a.struggled / a.attempted || b.struggled - a.struggled);
}

/** Assigned tasks the fewest students attempted. */
export function leastAttempted(
  entries: BatchEntry[]
): { title: string; category: TaskCategory; attempted: number; assignedTo: number }[] {
  return ALL_TASKS.map((t) => {
    const assigned = entries.filter((e) => gradedTaskIds(e.submission.assignedTasks).includes(t.id));
    return {
      title: t.shortTitle,
      category: t.category,
      assignedTo: assigned.length,
      attempted: assigned.filter((e) => e.submission.completedTasks.some((c) => c.taskId === t.id)).length,
    };
  })
    .filter((t) => t.assignedTo > 0 && t.attempted < t.assignedTo)
    .sort((a, b) => a.attempted / a.assignedTo - b.attempted / b.assignedTo);
}

/** "12/15": assigned tasks done, out of assigned (or all tasks). */
export function doneLabel(s: StudentSubmission): string {
  return `${gradedDoneCount(s.completedTasks, s.assignedTasks)}/${gradedTaskIds(s.assignedTasks).length}`;
}

export function formatDate(ms: number): string {
  if (!ms) return '';
  return new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** Gradebook CSV, downloaded straight to the teacher's computer. */
export function downloadBatchCsv(entries: BatchEntry[]) {
  const esc = (v: unknown) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = [
    'Student', 'Assignment', 'Submitted',
    'Main Grade (Ear + Doctor)', 'Main Letter',
    'Patch Master Grade %', 'Patch Master Tried', 'Patch Master Avg Best Match', 'Patch Master Total Tries',
    'Sound Design Turned In', 'Sound Design Grade (by ear)',
    'Assigned Tasks Done',
    ...TASK_CATEGORIES.flatMap((c) => [`${c} Done`, `${c} Avg`]),
    ...ALL_TASKS.map((t) => t.title),
  ];
  const rows = entries.map((e) => {
    const s = e.submission;
    return [
      s.studentName,
      s.assignmentCode,
      s.timestamp ? new Date(s.timestamp).toISOString().slice(0, 16).replace('T', ' ') : '',
      e.grades.main?.score ?? 'N/A',
      e.letter || 'N/A',
      e.grades.patchMaster?.score ?? 'N/A',
      e.grades.patchMaster ? `${e.grades.patchMaster.tried}/${e.grades.patchMaster.total}` : 'N/A',
      e.grades.patchMaster?.avgBestMatch ?? '',
      e.grades.patchMaster?.totalTries ?? '',
      e.grades.design ? `${e.grades.design.submitted}/${e.grades.design.total}` : 'N/A',
      '', // left blank for the teacher
      doneLabel(s),
      ...TASK_CATEGORIES.flatMap((c) => [
        `${e.categories[c].done}/${e.categories[c].total}`,
        e.categories[c].done ? e.categories[c].average : '',
      ]),
      // blank = not done; "–" = not part of this student's assignment
      ...ALL_TASKS.map((t) => {
        if (!gradedTaskIds(s.assignedTasks).includes(t.id)) return '–';
        const done = s.completedTasks.find((c) => c.taskId === t.id);
        if (!done) return '';
        return isDesignBrief(t.id) ? `turned in${s.briefs?.[t.id]?.hints ? ` (${s.briefs[t.id].hints} hints)` : ''}` : done.score;
      }),
    ].map(esc).join(',');
  });
  const blob = new Blob([[header.map(esc).join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `synthlab-grades-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
