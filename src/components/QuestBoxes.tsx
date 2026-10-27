import React from 'react';
import { StudentSubmission, SynthParams, PhraseId, BriefWork } from '../types';
import {
  ALL_TASKS,
  TaskCategory,
  DESIGN_REQUIRED,
  gradedTaskIds,
  gradesFor,
  isByEar,
} from '../utils/taskCatalog';
import { BriefReviewList } from './BriefReviewList';
import { Check, Circle, BookOpen, AlertTriangle } from 'lucide-react';

/** "85%", "best 85% · 3 tries" for Patch Master, or "turned in" for a saved sound. */
export const scoreLabel = (t: { taskId?: string; score: number; tries?: number }) =>
  t.taskId && isByEar(t.taskId)
    ? 'turned in'
    : t.tries
    ? `best ${Math.round(t.score)}% · ${t.tries} ${t.tries === 1 ? 'try' : 'tries'}`
    : `${Math.round(t.score)}%`;

type Tone = { box: string; head: string; label: string };
// Full class names so Tailwind can find them.
const TONES: Record<'indigo' | 'cyan' | 'emerald' | 'violet' | 'fuchsia' | 'amber', Tone> = {
  indigo: { box: 'border-indigo-500/35 bg-indigo-950/20', head: 'border-indigo-500/25', label: 'text-indigo-300' },
  cyan: { box: 'border-cyan-500/35 bg-cyan-950/20', head: 'border-cyan-500/25', label: 'text-cyan-300' },
  emerald: { box: 'border-emerald-500/35 bg-emerald-950/20', head: 'border-emerald-500/25', label: 'text-emerald-300' },
  violet: { box: 'border-violet-500/35 bg-violet-950/20', head: 'border-violet-500/25', label: 'text-violet-300' },
  fuchsia: { box: 'border-fuchsia-500/35 bg-fuchsia-950/20', head: 'border-fuchsia-500/25', label: 'text-fuchsia-300' },
  amber: { box: 'border-amber-500/35 bg-amber-950/20', head: 'border-amber-500/25', label: 'text-amber-300' },
};

/** The five challenges, in the same order as the Challenges tab. */
const QUESTS: { n: number; category: TaskCategory; name: string; tone: keyof typeof TONES }[] = [
  { n: 1, category: 'Blind Ear Test', name: 'A/B Ear Training', tone: 'cyan' },
  { n: 2, category: 'Synth Doctor', name: 'Synth Doctor', tone: 'emerald' },
  { n: 3, category: 'My Presets', name: 'My Presets', tone: 'violet' },
  { n: 4, category: 'Sound Design', name: 'Sound Design', tone: 'fuchsia' },
  { n: 5, category: 'Patch Matcher', name: 'Patch Master', tone: 'amber' },
];

interface QuestBoxesProps {
  completedTasks: StudentSubmission['completedTasks'];
  assignedTasks?: string[];
  briefs?: Record<string, BriefWork>;
  /** Learn walkthrough progress; undefined means the code was made before Learn was tracked. */
  learn?: StudentSubmission['learn'];
  onPlay?: (taskId: string, params: SynthParams, phrase?: PhraseId) => void;
  onLoad?: (params: SynthParams) => void;
}

const Shell: React.FC<{ tone: Tone; kicker: string; title: string; summary?: React.ReactNode; children?: React.ReactNode }> = ({
  tone,
  kicker,
  title,
  summary,
  children,
}) => (
  <section className={`rounded-xl border ${tone.box} p-3 font-mono`}>
    <div className={`flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 pb-2 ${children ? `border-b ${tone.head} mb-2` : ''}`}>
      <div>
        <span className={`block text-[10px] uppercase tracking-widest font-bold ${tone.label}`}>{kicker}</span>
        <h4 className="text-sm font-bold text-white leading-tight">{title}</h4>
      </div>
      {summary && <div className="text-[11px] text-slate-300 text-right">{summary}</div>}
    </div>
    {children}
  </section>
);

const Row: React.FC<{ title: string; value: React.ReactNode; done: boolean; muted?: boolean }> = ({ title, value, done, muted }) => (
  <div
    className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border text-[11px] ${
      done ? 'bg-slate-900/80 border-white/5' : 'bg-slate-900/40 border-white/5'
    } ${muted ? 'opacity-50' : ''}`}
  >
    <span className={`flex items-center gap-1.5 min-w-0 ${done ? 'text-slate-200' : 'text-slate-500'}`}>
      {done ? <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <Circle className="w-3.5 h-3.5 text-slate-600 shrink-0" />}
      <span className="truncate" title={title}>{title}</span>
    </span>
    <span className={`shrink-0 font-bold ${done ? 'text-emerald-400' : 'text-slate-600'}`}>{value}</span>
  </div>
);

/**
 * The grade report, one box per part of the app in the order students meet them:
 * Learn, then the five challenges. Used for a student's own report and for a teacher checking a code.
 */
export const QuestBoxes: React.FC<QuestBoxesProps> = ({ completedTasks, assignedTasks, briefs, learn, onPlay, onLoad }) => {
  const graded = new Set(gradedTaskIds(assignedTasks));
  const byId = new Map<string, StudentSubmission['completedTasks'][number]>(completedTasks.map((t) => [t.taskId, t]));
  const grades = gradesFor(completedTasks, assignedTasks);

  // ---- Learn ----
  const learnTone = TONES.indigo;
  const learnBox = (() => {
    if (!learn) {
      return (
        <Shell tone={learnTone} kicker="Learn" title="Signal-path walkthrough" summary={<span className="text-slate-400">not recorded</span>}>
          <p className="text-[11px] text-slate-400">This code was made before Learn progress was tracked, so there is nothing to show.</p>
        </Shell>
      );
    }
    const all = learn.done >= learn.total;
    const none = learn.done === 0;
    return (
      <Shell
        tone={learnTone}
        kicker="Learn"
        title="Signal-path walkthrough"
        summary={
          <span className={`font-bold ${all ? 'text-emerald-400' : none ? 'text-rose-300' : 'text-amber-300'}`}>
            {all ? 'Completed' : none ? 'Not started' : 'Not finished'} · {learn.done}/{learn.total} steps
          </span>
        }
      >
        <div className="flex items-center gap-2">
          {all ? (
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          )}
          <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
            <div className={`h-full ${all ? 'bg-emerald-400' : 'bg-amber-400'}`} style={{ width: `${(100 * learn.done) / learn.total}%` }} />
          </div>
          <BookOpen className="w-4 h-4 text-indigo-300 shrink-0" />
        </div>
      </Shell>
    );
  })();

  return (
    <div className="space-y-2.5">
      {learnBox}

      {QUESTS.map((q) => {
        const tone = TONES[q.tone];
        const kicker = `Quest ${q.n}`;
        const tasks = ALL_TASKS.filter((t) => t.category === q.category);
        const assigned = tasks.filter((t) => graded.has(t.id));
        const doneAssigned = assigned.filter((t) => byId.has(t.id));

        // Not part of this student's assignment and nothing done there
        if (!assigned.length && !tasks.some((t) => byId.has(t.id))) {
          return (
            <Shell key={q.n} tone={tone} kicker={kicker} title={q.name} summary={<span className="text-slate-500">not assigned</span>} />
          );
        }

        // Sound Design and My Presets are heard, not scored
        if (q.category === 'My Presets' || q.category === 'Sound Design') {
          const isPresets = q.category === 'My Presets';
          const g = isPresets ? grades.myPresets : grades.design;
          const turnedIn = tasks.filter((t) => byId.has(t.id)).length;
          return (
            <Shell
              key={q.n}
              tone={tone}
              kicker={kicker}
              title={q.name}
              summary={
                <>
                  <span className="font-bold text-white">
                    {g ? `${g.submitted}/${g.total}` : turnedIn}
                  </span>{' '}
                  turned in{!isPresets ? ` · ${DESIGN_REQUIRED} needed` : ''} · graded by ear
                </>
              }
            >
              <BriefReviewList
                briefs={briefs}
                assigned={isPresets ? assigned.map((t) => t.id) : undefined}
                only={isPresets ? 'presets' : 'design'}
                onPlay={onPlay}
                onLoad={onLoad}
              />
              {turnedIn === 0 && !isPresets && <p className="text-[11px] text-slate-500 italic">Nothing turned in yet.</p>}
            </Shell>
          );
        }

        // Scored challenges: every assigned task, done or not (plus any extras that were done)
        const rows = [...assigned, ...tasks.filter((t) => !graded.has(t.id) && byId.has(t.id))];
        const scores = doneAssigned.map((t) => byId.get(t.id)!.score);
        const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
        const isPatch = q.category === 'Patch Matcher';
        const pmGrade = isPatch ? grades.patchMaster : null;

        return (
          <Shell
            key={q.n}
            tone={tone}
            kicker={kicker}
            title={q.name}
            summary={
              isPatch ? (
                <>
                  tried <b className="text-white">{doneAssigned.length}/{assigned.length}</b>
                  {pmGrade ? (
                    <>
                      {' '}· grade <b className="text-white">{pmGrade.score}%</b>
                    </>
                  ) : null}
                </>
              ) : (
                <>
                  <b className="text-white">{doneAssigned.length}/{assigned.length}</b> done
                  {avg !== null && (
                    <>
                      {' '}· avg <b className="text-white">{avg}%</b>
                    </>
                  )}
                </>
              )
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {rows.map((t) => {
                const done = byId.get(t.id);
                const extra = !graded.has(t.id);
                return (
                  <div key={t.id} title={extra ? 'Extra: not part of the assignment, so not counted' : undefined}>
                    <Row
                      title={t.shortTitle}
                      done={!!done}
                      muted={extra}
                      value={done ? scoreLabel({ ...done, taskId: t.id }) : 'not done'}
                    />
                  </div>
                );
              })}
            </div>
            {isPatch && pmGrade && pmGrade.avgBestMatch !== null && (
              <p className="mt-1.5 text-[10px] text-slate-500">
                avg best match {pmGrade.avgBestMatch}% · {pmGrade.totalTries} tries in all · 50% for trying + 50% from match score (85%+ = full)
              </p>
            )}
          </Shell>
        );
      })}
    </div>
  );
};
