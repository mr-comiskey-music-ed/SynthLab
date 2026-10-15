import React, { useState, useEffect, useRef } from 'react';
import { SynthParams, StudentSubmission } from '../types';
import { encodeSubmission, decodeSubmission, DecodedSubmission } from '../utils/submissionCodec';
import { totalScoreFor, TOTAL_TASK_COUNT, taskInfo } from '../utils/taskCatalog';
import { formatDate } from '../utils/batchGrading';
import { copyText } from '../utils/copyText';
import {
  GraduationCap,
  Check,
  ShieldCheck,
  X,
  Award,
  AlertTriangle,
  Copy,
  ListChecks,
  Headphones,
  Loader2,
} from 'lucide-react';

export interface SharedReport {
  code: string;
  decoded: DecodedSubmission | null;
}

interface ModeTeacherProps {
  currentParams: SynthParams;
  completedTasks: { taskId: string; taskTitle: string; score: number }[];
  assignmentCodeFromUrl?: string;
  /** A code that arrived in the page link (?report=...). */
  sharedReport?: SharedReport | null;
  onLoadParams: (params: SynthParams) => void;
  onOpenBatchGrade: () => void;
}

const BAD_CODE = 'That code couldn’t be read. It may be incomplete, mistyped or edited. Ask the student to copy it again.';

export const ModeTeacher: React.FC<ModeTeacherProps> = ({
  currentParams,
  completedTasks,
  assignmentCodeFromUrl = 'SYNTH_LAB_01',
  sharedReport = null,
  onLoadParams,
  onOpenBatchGrade,
}) => {
  const [studentName, setStudentName] = useState<string>('');
  // The student's own locked submission
  const [submission, setSubmission] = useState<StudentSubmission | null>(null);
  const [rawReportCode, setRawReportCode] = useState<string>('');
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'manual'>('idle');
  const [isLocking, setIsLocking] = useState(false);
  const codeBoxRef = useRef<HTMLTextAreaElement>(null);

  // A code the teacher checked (or that came in the link)
  const [checked, setChecked] = useState<DecodedSubmission | null>(null);
  const [manualReportInput, setManualReportInput] = useState<string>('');
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [patchLoaded, setPatchLoaded] = useState(false);

  useEffect(() => {
    if (!sharedReport) return;
    if (sharedReport.decoded) {
      setChecked(sharedReport.decoded);
      setPatchLoaded(false);
    } else {
      setVerificationError(BAD_CODE);
    }
  }, [sharedReport]);

  const handleCheckCode = async () => {
    if (!manualReportInput.trim()) return;
    setVerificationError(null);
    setIsChecking(true);
    const decoded = await decodeSubmission(manualReportInput);
    setIsChecking(false);
    if (decoded) {
      setChecked(decoded);
      setPatchLoaded(false);
      setManualReportInput('');
    } else {
      setVerificationError(BAD_CODE);
    }
  };

  const totalScore = totalScoreFor(completedTasks);

  const handleLockSubmission = async () => {
    if (!studentName.trim()) {
      alert('Please enter your full student name before generating your code.');
      return;
    }
    const newSub: StudentSubmission = {
      studentName: studentName.trim(),
      assignmentCode: assignmentCodeFromUrl,
      timestamp: Date.now(),
      totalScore,
      completedTasks,
      encodedVerification: '',
      patchUrl: '',
    };
    setIsLocking(true);
    const code = await encodeSubmission(newSub, currentParams);
    setIsLocking(false);
    setSubmission(newSub);
    setRawReportCode(code);
    setCopyState('idle');
  };

  const handleCopySubmissionCode = async () => {
    if (!rawReportCode) return;
    const ok = await copyText(rawReportCode);
    if (ok) {
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2500);
    } else {
      // Clipboard blocked: select the code so the student can press Ctrl+C.
      codeBoxRef.current?.focus();
      codeBoxRef.current?.select();
      setCopyState('manual');
    }
  };

  const checkedSub = checked?.submission;

  return (
    <div id="mode-teacher-panel" className="space-y-4 mb-4 max-w-4xl mx-auto">
      <div className="rounded-xl bg-gradient-to-r from-slate-900 via-[#13161c] to-slate-900 border border-amber-500/40 p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <GraduationCap className="w-7 h-7 text-amber-400" />
            <div>
              <span className="text-[10px] font-mono text-amber-400 uppercase tracking-widest font-bold">
                STUDENT GRADE REPORT & SUBMISSION
              </span>
              <h3 className="text-lg font-bold text-white">Grade Report & Submission Code</h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">Overall Grade:</span>
            <span className="text-lg font-mono font-bold text-amber-400 px-3 py-1 rounded bg-black/40 border border-amber-500/30">
              {totalScore} / 100
            </span>
          </div>
        </div>

        {/* Name input & Generate Code button */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end mb-6">
          <div className="md:col-span-5">
            <label className="block text-xs font-mono text-slate-300 font-semibold mb-1.5">
              Your Full Name:
            </label>
            <input
              type="text"
              placeholder="e.g. Maya Lin"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-black/50 text-amber-300 font-mono text-sm border border-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
          </div>

          <div className="md:col-span-4">
            <span className="block text-xs font-mono text-slate-300 font-semibold mb-1.5">
              Completed Tasks: {completedTasks.length}/{TOTAL_TASK_COUNT}
            </span>
            <div className="text-xs font-mono text-slate-400 py-2">
              Your current patch is saved in the code too.
            </div>
          </div>

          <div className="md:col-span-3">
            <button
              type="button"
              onClick={handleLockSubmission}
              disabled={isLocking}
              className="w-full py-2.5 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-mono font-bold text-xs uppercase flex items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(245,158,11,0.3)] active:scale-95 transition-all"
            >
              {isLocking ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              {submission ? 'Update My Code' : 'Generate My Code'}
            </button>
          </div>
        </div>

        {/* Submission code */}
        {submission && (
          <div className="p-5 rounded-xl bg-black/70 border border-emerald-500/50 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5 text-emerald-400" />
                <span className="text-xs font-mono font-bold text-emerald-300 uppercase tracking-wide">
                  Grade Report Ready
                </span>
              </div>
              <span className="text-xs font-mono text-slate-300">
                Final Grade: <strong className="text-emerald-300 text-sm font-bold">{submission.totalScore}/100</strong>
              </span>
            </div>

            {/* Quest breakdown */}
            <div className="space-y-2">
              <span className="block text-xs font-mono text-slate-400 uppercase tracking-wider font-semibold">
                Quests & Challenges Completed ({submission.completedTasks.length}):
              </span>
              {submission.completedTasks.length === 0 ? (
                <div className="text-xs font-mono text-slate-500 italic p-2 bg-slate-900/40 rounded">
                  No quests completed yet. Complete challenges in the Challenges tab to record scores.
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {submission.completedTasks.map((task, idx) => (
                    <div
                      key={task.taskId || idx}
                      className="flex items-center justify-between p-2 rounded bg-slate-900/80 border border-white/5 text-xs font-mono"
                    >
                      <span className="text-slate-200">{task.taskTitle}</span>
                      <span className="text-emerald-400 font-bold">{Math.round(task.score)}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3 pt-3 border-t border-white/10">
              <label className="block text-xs font-mono text-emerald-300 font-bold uppercase tracking-wider">
                Your Submission Code for Google Classroom:
              </label>
              <textarea
                ref={codeBoxRef}
                readOnly
                rows={3}
                value={rawReportCode}
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                className="w-full px-3 py-2 rounded-lg bg-black/90 text-emerald-400 font-mono text-xs border border-emerald-500/40 focus:outline-none focus:ring-1 focus:ring-emerald-400 break-all"
              />

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <p className="text-xs font-mono text-slate-300 max-w-md flex-1">
                  {copyState === 'manual' ? (
                    <span className="text-amber-300">
                      Your browser blocked copying. The code is selected — press <b>Ctrl+C</b> to copy it.
                    </span>
                  ) : (
                    'Copy this code and paste it into your Google Classroom assignment.'
                  )}
                </p>
                <button
                  type="button"
                  onClick={handleCopySubmissionCode}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold text-xs uppercase flex items-center justify-center gap-2 shadow-[0_0_12px_rgba(16,185,129,0.3)] active:scale-95 transition-all flex-shrink-0"
                >
                  {copyState === 'copied' ? (
                    <>
                      <Check className="w-4 h-4" />
                      Code Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy Code
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Teacher tools */}
        <div className="mt-6 pt-4 border-t border-white/10 space-y-2">
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <span className="text-xs font-mono text-amber-400 font-bold whitespace-nowrap">Teacher Code Check:</span>
            <input
              type="text"
              placeholder="Paste one student's code..."
              value={manualReportInput}
              onChange={(e) => {
                setManualReportInput(e.target.value);
                setVerificationError(null);
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleCheckCode()}
              className="flex-1 w-full px-3 py-1.5 rounded bg-black/70 text-slate-100 font-mono text-xs border border-amber-500/30 focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
            <button
              type="button"
              onClick={handleCheckCode}
              disabled={isChecking}
              className="px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-black font-mono font-bold text-xs uppercase flex items-center gap-1 flex-shrink-0"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Check
            </button>
            <button
              type="button"
              onClick={onOpenBatchGrade}
              className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-amber-500/40 text-amber-300 font-mono font-bold text-xs uppercase flex items-center gap-1 flex-shrink-0"
            >
              <ListChecks className="w-3.5 h-3.5" />
              Batch Grade a Class
            </button>
          </div>
          {verificationError && (
            <div className="p-2 rounded bg-red-950/80 border border-red-500/60 text-red-200 text-xs font-mono flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
              <span>{verificationError}</span>
            </div>
          )}
        </div>
      </div>

      {/* Checked student's report */}
      {checkedSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-2xl rounded-2xl bg-slate-950 border-2 border-amber-500/50 p-6 shadow-2xl text-slate-100 space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] font-mono text-amber-400 uppercase tracking-widest font-bold">
                    VERIFIED GRADE REPORT
                  </span>
                  <h3 className="text-lg font-bold text-white">Subtractive Synthesis Lab</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setChecked(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-900/80 border border-white/10 font-mono text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">Student Name:</span>
                <strong className="text-amber-300 text-sm">{checkedSub.studentName}</strong>
                {checkedSub.timestamp > 0 && (
                  <span className="block text-[10px] text-slate-500 mt-0.5">Submitted {formatDate(checkedSub.timestamp)}</span>
                )}
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Overall Grade:</span>
                <strong className="text-emerald-400 text-base">{checkedSub.totalScore} / 100</strong>
                <span className="block text-[10px] text-slate-500 mt-0.5">
                  {checkedSub.completedTasks.length}/{TOTAL_TASK_COUNT} tasks · {checkedSub.assignmentCode}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <span className="block text-xs font-mono text-slate-400 uppercase tracking-wider font-semibold">
                Quests Breakdown ({checkedSub.completedTasks.length}):
              </span>
              <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                {checkedSub.completedTasks.map((t, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-white/5 font-mono text-xs"
                  >
                    <span className="text-slate-200">{taskInfo(t.taskId)?.title ?? t.taskTitle}</span>
                    <span className="text-emerald-400 font-bold">{Math.round(t.score)}%</span>
                  </div>
                ))}
              </div>
            </div>

            {checked?.patchParams && (
              <button
                type="button"
                onClick={() => {
                  onLoadParams(checked.patchParams!);
                  setPatchLoaded(true);
                }}
                className="w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold text-xs uppercase flex items-center justify-center gap-1.5"
              >
                {patchLoaded ? <Check className="w-4 h-4" /> : <Headphones className="w-4 h-4" />}
                {patchLoaded ? 'Patch loaded on the synth' : 'Load their patch onto the synth'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
