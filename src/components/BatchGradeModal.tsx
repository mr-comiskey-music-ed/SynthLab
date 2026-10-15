import React, { useMemo, useState } from 'react';
import {
  X,
  ListChecks,
  AlertTriangle,
  CheckCircle2,
  Download,
  Headphones,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Lightbulb,
  Lock,
  Loader2,
} from 'lucide-react';
import {
  BatchParseResult,
  BatchEntry,
  classPatterns,
  leastAttempted,
  downloadBatchCsv,
  doneLabel,
  formatDate,
  STRUGGLE_THRESHOLD,
} from '../utils/batchGrading';
import { ALL_TASKS, TASK_CATEGORIES, taskInfo, gradedTaskIds, gradedDoneCount } from '../utils/taskCatalog';

const taskOrder = (id: string) => {
  const i = ALL_TASKS.findIndex((t) => t.id === id);
  return i < 0 ? ALL_TASKS.length : i;
};

type SortKey = 'name' | 'score' | 'effort' | 'tasks';

interface BatchGradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  text: string;
  onTextChange: (text: string) => void;
  result: BatchParseResult | null;
  isGrading: boolean;
  onGrade: () => void;
  onClear: () => void;
  /** Load patches in this order (entry ids), starting at position `start`. */
  onReview: (order: number[], start: number) => void;
}

export const gradeColor = (pct: number) =>
  pct >= 90 ? 'text-emerald-300 bg-emerald-500/15 border-emerald-500/40'
  : pct >= 70 ? 'text-amber-300 bg-amber-500/15 border-amber-500/40'
  : 'text-rose-300 bg-rose-500/15 border-rose-500/40';

const lastName = (full: string) => {
  const parts = full.trim().split(/\s+/);
  return (parts.length > 1 ? parts[parts.length - 1] + ' ' + parts.slice(0, -1).join(' ') : full).toLowerCase();
};

const CATEGORY_SHORT: Record<string, string> = {
  'Patch Matcher': 'Patch',
  'Synth Doctor': 'Doctor',
  'Blind Ear Test': 'Ear',
};

export const BatchGradeModal: React.FC<BatchGradeModalProps> = ({
  isOpen,
  onClose,
  text,
  onTextChange,
  result,
  isGrading,
  onGrade,
  onClear,
  onReview,
}) => {
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [assignmentFilter, setAssignmentFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showPatterns, setShowPatterns] = useState(true);

  const entries = result?.entries ?? [];
  const assignments = useMemo(
    () => Array.from(new Set<string>(entries.map((e) => e.submission.assignmentCode))).sort(),
    [entries]
  );

  const visible: BatchEntry[] = useMemo(() => {
    const list = entries.filter((e) => assignmentFilter === 'all' || e.submission.assignmentCode === assignmentFilter);
    return [...list].sort((a, b) => {
      if (sortKey === 'score') return (b.grades.main?.score ?? -1) - (a.grades.main?.score ?? -1);
      if (sortKey === 'effort') return (b.grades.patchMaster?.score ?? -1) - (a.grades.patchMaster?.score ?? -1);
      if (sortKey === 'tasks')
        return (
          gradedDoneCount(b.submission.completedTasks, b.submission.assignedTasks) -
          gradedDoneCount(a.submission.completedTasks, a.submission.assignedTasks)
        );
      return lastName(a.submission.studentName).localeCompare(lastName(b.submission.studentName));
    });
  }, [entries, sortKey, assignmentFilter]);

  const patterns = useMemo(() => classPatterns(visible), [visible]);
  const skipped = useMemo(() => leastAttempted(visible), [visible]);
  const avgOf = (nums: number[]) => (nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : null);
  const mainAverage = avgOf(visible.flatMap((e) => (e.grades.main ? [e.grades.main.score] : [])));
  const effortAverage = avgOf(visible.flatMap((e) => (e.grades.patchMaster ? [e.grades.patchMaster.score] : [])));
  const letterCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of visible) if (e.letter) m.set(e.letter, (m.get(e.letter) || 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [visible]);

  if (!isOpen) return null;
  const order = visible.map((e) => e.id);
  const pill = 'px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/10 text-slate-200 font-bold flex items-center gap-1.5 disabled:opacity-40';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-4xl rounded-2xl bg-slate-950 border-2 border-amber-500/40 p-5 shadow-2xl text-slate-100 font-mono flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400">
              <ListChecks className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Batch Grade a Class</h3>
              <p className="text-[11px] text-slate-400 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                Codes and results stay in this tab only. Nothing is saved or sent anywhere.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!result ? (
          /* ---------- Paste view ---------- */
          <div className="space-y-3 flex flex-col min-h-0">
            <p className="text-xs text-slate-300">
              Paste all your students' codes below. One per line works, and so does a whole column copied from
              Google Classroom or a spreadsheet. Names and other text mixed in are ignored. Older (longer) codes work too.
            </p>
            <textarea
              autoFocus
              rows={12}
              value={text}
              onChange={(e) => onTextChange(e.target.value)}
              placeholder="Paste student codes here..."
              className="w-full bg-black/70 border border-slate-700 focus:border-amber-400 rounded-lg p-3 text-[11px] text-emerald-400 outline-none resize-none placeholder:text-slate-500"
            />
            <button
              type="button"
              onClick={onGrade}
              disabled={!text.trim() || isGrading}
              className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold text-xs uppercase flex items-center justify-center gap-1.5"
            >
              {isGrading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ListChecks className="w-4 h-4" />}
              {isGrading ? 'Reading codes…' : 'Grade All Codes'}
            </button>
          </div>
        ) : (
          /* ---------- Results view ---------- */
          <div className="space-y-3 overflow-y-auto pr-1 min-h-0 text-xs">
            {/* Summary */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
                <b className="text-white">{visible.length}</b> graded
              </span>
              {mainAverage !== null && (
                <span className={`px-3 py-1.5 rounded-lg border font-bold ${gradeColor(mainAverage)}`} title="A/B Ear Training + Synth Doctor">
                  Main grade avg {mainAverage}%
                </span>
              )}
              {letterCounts.map(([letter, n]) => (
                <span key={letter} className="px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-300">
                  {letter}: <b className="text-white">{n}</b>
                </span>
              ))}
              {effortAverage !== null && (
                <span className={`px-3 py-1.5 rounded-lg border font-bold ${gradeColor(effortAverage)}`} title="50% for trying each patch, 50% from match scores (85%+ = full points)">
                  Patch Master avg {effortAverage}%
                </span>
              )}
              <div className="ml-auto flex gap-2">
                <button type="button" onClick={() => downloadBatchCsv(visible)} disabled={!visible.length} className={pill}>
                  <Download className="w-3.5 h-3.5" /> Download CSV
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setExpandedId(null);
                    setAssignmentFilter('all');
                    onClear();
                  }}
                  className={pill}
                >
                  <RotateCcw className="w-3.5 h-3.5" /> New Batch
                </button>
              </div>
            </div>

            {/* Problems with the paste */}
            {(result.unreadable.length > 0 || result.duplicatesRemoved > 0) && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-[11px] text-amber-200 space-y-1">
                {result.unreadable.length > 0 && (
                  <div className="flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
                    <span>
                      <b>{result.unreadable.length}</b> code{result.unreadable.length > 1 ? 's' : ''} couldn't be read
                      (incomplete, mistyped or edited):{' '}
                      <span className="font-bold text-amber-100">{result.unreadable.join(', ')}</span>. Ask
                      {result.unreadable.length > 1 ? ' these students' : ' this student'} to copy their code again.
                    </span>
                  </div>
                )}
                {result.duplicatesRemoved > 0 && (
                  <div>
                    {result.duplicatesRemoved} exact duplicate code{result.duplicatesRemoved > 1 ? 's were' : ' was'} skipped.
                  </div>
                )}
              </div>
            )}

            {entries.length === 0 ? (
              <p className="text-slate-400 p-4 text-center">No readable codes were found in what you pasted.</p>
            ) : (
              <>
                {/* Class patterns */}
                {(patterns.length > 0 || skipped.length > 0) && (
                  <div className="p-3 bg-sky-500/10 border border-sky-500/30 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setShowPatterns(!showPatterns)}
                      className="w-full flex items-center gap-1.5 font-bold text-sky-300"
                    >
                      {showPatterns ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      <Lightbulb className="w-4 h-4" /> Class patterns
                    </button>
                    {showPatterns && (
                      <div className="mt-2 space-y-3">
                        {patterns.length > 0 && (
                          <div className="space-y-1.5">
                            <div className="text-[10px] uppercase tracking-wider text-sky-200/70">
                              Where students who tried lost points (wrong answer, not fixed, or under {STRUGGLE_THRESHOLD}%)
                            </div>
                            {patterns.slice(0, 6).map((p) => {
                              const pct = Math.round((100 * p.struggled) / p.attempted);
                              return (
                                <div key={p.taskId} className="flex items-center gap-2 text-[11px]">
                                  <span className="w-16 shrink-0 text-sky-200/70">{CATEGORY_SHORT[p.category]}</span>
                                  <span className="flex-1 min-w-0 text-slate-200" title={p.title}>{p.title}</span>
                                  <div className="w-24 sm:w-32 h-2 rounded-full bg-white/10 overflow-hidden shrink-0">
                                    <div className="h-full bg-sky-400/70" style={{ width: `${pct}%` }} />
                                  </div>
                                  <span className="w-24 shrink-0 text-right text-slate-300">
                                    {p.struggled} of {p.attempted}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {skipped.length > 0 && (
                          <div className="text-[11px] text-slate-300">
                            <span className="text-[10px] uppercase tracking-wider text-sky-200/70">Least attempted: </span>
                            {skipped.slice(0, 4).map((t, i) => (
                              <span key={t.title}>
                                {i > 0 && ' · '}
                                {t.title} <span className="text-slate-500">({t.attempted}/{t.assignedTo})</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Controls */}
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="text-slate-400">Sort:</span>
                  {(['name', 'score', 'effort', 'tasks'] as SortKey[]).map((k) => (
                    <button
                      type="button"
                      key={k}
                      onClick={() => setSortKey(k)}
                      className={`px-2.5 py-1 rounded-lg border ${
                        sortKey === k ? 'bg-amber-500 text-black border-amber-400 font-bold' : 'bg-white/5 border-white/10 text-slate-300'
                      }`}
                    >
                      {k === 'name' ? 'Last name' : k === 'score' ? 'Main grade' : k === 'effort' ? 'Patch Master' : 'Tasks done'}
                    </button>
                  ))}
                  {assignments.length > 1 && (
                    <>
                      <span className="text-slate-400 ml-2">Assignment:</span>
                      <select
                        value={assignmentFilter}
                        onChange={(e) => setAssignmentFilter(e.target.value)}
                        className="bg-slate-900 border border-white/20 rounded-lg px-2 py-1 text-slate-200"
                      >
                        <option value="all">All</option>
                        {assignments.map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => onReview(order, 0)}
                    disabled={!order.length}
                    className="ml-auto px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold flex items-center gap-1.5 disabled:opacity-40"
                  >
                    <Headphones className="w-3.5 h-3.5" /> Review Patches in This Order
                  </button>
                </div>

                {/* Table */}
                <div className="border border-white/10 rounded-xl overflow-hidden">
                  <div className="grid grid-cols-[1fr_120px_56px_64px_96px] sm:grid-cols-[1fr_170px_64px_80px_110px] gap-2 px-3 py-2 bg-white/5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <span>Student</span>
                    <span>Assigned done (Patch · Doctor · Ear)</span>
                    <span className="text-center" title="A/B Ear Training + Synth Doctor">Main</span>
                    <span className="text-center" title="Patch Master: 50% for trying, 50% from match scores">Patch Master</span>
                    <span />
                  </div>
                  {visible.map((e, pos) => {
                    const open = expandedId === e.id;
                    const s = e.submission;
                    return (
                      <div key={e.id} className="border-t border-white/5">
                        <div
                          onClick={() => setExpandedId(open ? null : e.id)}
                          className="grid grid-cols-[1fr_120px_56px_64px_96px] sm:grid-cols-[1fr_170px_64px_80px_110px] gap-2 px-3 py-2 items-center hover:bg-white/5 cursor-pointer"
                        >
                          <span className="font-bold text-white truncate flex items-center gap-1.5">
                            {open ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
                            {s.studentName || 'Unnamed student'}
                            {e.hasMultipleSubmissions && (
                              <span className="text-[9px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-1.5 rounded shrink-0">
                                multiple codes
                              </span>
                            )}
                          </span>
                          <span className="text-slate-300">
                            {doneLabel(s)}{' '}
                            <span className="text-slate-500">
                              ({TASK_CATEGORIES.map((c) => e.categories[c].done).join(' · ')})
                            </span>
                          </span>
                          {e.grades.main ? (
                            <span className={`text-center font-bold rounded border px-1.5 py-0.5 ${gradeColor(e.grades.main.score)}`}>
                              {e.grades.main.score}%
                            </span>
                          ) : (
                            <span className="text-center text-slate-500">–</span>
                          )}
                          {e.grades.patchMaster ? (
                            <span
                              className={`text-center font-bold rounded border px-1.5 py-0.5 ${gradeColor(e.grades.patchMaster.score)}`}
                              title={`Tried ${e.grades.patchMaster.tried} of ${e.grades.patchMaster.total} patches · ${e.grades.patchMaster.totalTries} tries${
                                e.grades.patchMaster.avgBestMatch !== null ? ` · avg best match ${e.grades.patchMaster.avgBestMatch}%` : ''
                              }`}
                            >
                              {e.grades.patchMaster.score}%
                            </span>
                          ) : (
                            <span className="text-center text-slate-500">–</span>
                          )}
                          <button
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              onReview(order, pos);
                            }}
                            disabled={!e.patchParams}
                            title={e.patchParams ? 'Load this student’s patch onto the synth' : 'This code has no patch saved in it'}
                            className="justify-self-end px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-bold text-[11px] flex items-center gap-1 disabled:opacity-40"
                          >
                            <Headphones className="w-3.5 h-3.5" /> Hear patch
                          </button>
                        </div>
                        {open && (
                          <div className="px-4 pb-3 pt-1 space-y-2 bg-white/[0.02]">
                            <div className="text-[10px] text-slate-500">
                              {s.assignmentCode}
                              {s.assignedTasks?.length ? ` · ${s.assignedTasks.length} assigned tasks` : ' · all 30 tasks'}
                              {s.timestamp ? ` · submitted ${formatDate(s.timestamp)}` : ''}
                            </div>
                            {(() => {
                              const missing = gradedTaskIds(s.assignedTasks).filter(
                                (id) => !s.completedTasks.some((t) => t.taskId === id)
                              );
                              return missing.length > 0 && missing.length < ALL_TASKS.length ? (
                                <div className="text-[11px] text-rose-200">
                                  <span className="text-rose-300 font-bold">Not done ({missing.length}): </span>
                                  {missing.map((id) => taskInfo(id)?.shortTitle ?? id).join(' · ')}
                                </div>
                              ) : null;
                            })()}
                            {s.completedTasks.length === 0 ? (
                              <div className="text-[11px] text-slate-500 italic">No tasks completed.</div>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                {[...s.completedTasks]
                                  .sort((a, b) => taskOrder(a.taskId) - taskOrder(b.taskId))
                                  .map((t) => {
                                    const good = t.score >= STRUGGLE_THRESHOLD;
                                    const counted = gradedTaskIds(s.assignedTasks).includes(t.taskId);
                                    return (
                                      <div
                                        key={t.taskId}
                                        className={`flex items-center justify-between gap-2 text-[11px] px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 ${counted ? '' : 'opacity-50'}`}
                                        title={counted ? undefined : 'Extra: not part of the assignment, so not counted'}
                                      >
                                        <span className="flex items-center gap-1.5 text-slate-200 min-w-0">
                                          {good ? (
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                          ) : (
                                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                          )}
                                          <span className="truncate" title={t.taskTitle}>
                                            {taskInfo(t.taskId)?.title ?? t.taskTitle}
                                          </span>
                                        </span>
                                        <span className={`font-bold shrink-0 ${good ? 'text-emerald-400' : 'text-amber-400'}`}>
                                          {t.tries ? `best ${Math.round(t.score)}% · ${t.tries} ${t.tries === 1 ? 'try' : 'tries'}` : `${Math.round(t.score)}%`}
                                        </span>
                                      </div>
                                    );
                                  })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
