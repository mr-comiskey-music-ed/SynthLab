import React, { useState, useEffect, useRef } from 'react';
import {
  SynthParams,
  ThemeMode,
  AppMode,
  Preset,
  StudentSubmission,
} from './types';
import { SubtractiveEngine } from './audio/synthEngine';
import { DEFAULT_SYNTH_PARAMS, INITIAL_PRESETS } from './utils/presets';
import { decodeSubmission, decodePatch } from './utils/submissionCodec';
import { parseBatch, BatchParseResult } from './utils/batchGrading';
import { cleanTaskList, isPatchMaster } from './utils/taskCatalog';
import { BatchGradeModal } from './components/BatchGradeModal';
import { BatchReviewBar } from './components/BatchReviewBar';
import { StudioRetroView } from './components/StudioRetroView';
import { MinilogueView } from './components/MinilogueView';
import { Keyboard } from './components/Keyboard';
import { ModeLearn } from './components/ModeLearn';
import { ModePlayground } from './components/ModePlayground';
import { ModeChallenges } from './components/ModeChallenges';
import { ModeTeacher, SharedReport } from './components/ModeTeacher';
import { MarbleWaveLogo } from './components/MarbleWaveLogo';
import {
  BookOpen,
  Gamepad2,
  Trophy,
  GraduationCap,
  Sparkles,
  Volume2,
  VolumeX,
  RefreshCw,
  Palette,
  Sliders,
  Share2,
  Download,
  Info,
  ShieldCheck,
  AlertTriangle,
  X,
} from 'lucide-react';

export default function App() {
  const [theme, setTheme] = useState<ThemeMode>('studio-retro');
  const [activeMode, setActiveMode] = useState<AppMode>('learn');
  const [params, setParams] = useState<SynthParams>(DEFAULT_SYNTH_PARAMS);
  const [audioStarted, setAudioStarted] = useState<boolean>(false);
  const [completedTasks, setCompletedTasks] = useState<StudentSubmission['completedTasks']>([]);
  const [highlightSection, setHighlightSection] = useState<string | null>(null);
  const [sharedReport, setSharedReport] = useState<SharedReport | null>(null);

  // Batch grading (kept in memory only; nothing is stored)
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [batchText, setBatchText] = useState('');
  const [batchResult, setBatchResult] = useState<BatchParseResult | null>(null);
  const [isGrading, setIsGrading] = useState(false);
  const [review, setReview] = useState<{ order: number[]; pos: number } | null>(null);
  const [savedParams, setSavedParams] = useState<SynthParams | null>(null);

  // URL query params tracking
  const [assignmentCode, setAssignmentCode] = useState<string>('SYNTH_LAB_01');
  const [assignedTasks, setAssignedTasks] = useState<string[]>([]);

  // Engine ref singleton
  const engineRef = useRef<SubtractiveEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = SubtractiveEngine.getInstance(DEFAULT_SYNTH_PARAMS);
  }
  const engine = engineRef.current;

  // Challenges open on the Modern Synth by default.
  useEffect(() => {
    if (activeMode === 'challenges') setTheme('hardware-bench');
  }, [activeMode]);

  // Initialize from URL params (e.g. shared patch, teacher assignment, shared report)
  useEffect(() => {
    const handleReportParam = async (reportParam: string) => {
      if (!reportParam) return;
      const decoded = await decodeSubmission(reportParam);
      setSharedReport({ code: reportParam, decoded });
      setActiveMode('teacher');
    };

    const handleAssignmentParam = (assignParam: string, tasksParam?: string) => {
      if (assignParam) setAssignmentCode(assignParam);
      if (tasksParam) {
        setAssignedTasks(cleanTaskList(tasksParam.split(',')));
        setActiveMode('challenges');
      }
    };

    // 1. window.location.search
    const query = new URLSearchParams(window.location.search);
    const patchData = query.get('patch');
    if (patchData) {
      decodePatch(patchData).then((decoded) => {
        if (!decoded) {
          console.error('Failed to read patch from URL');
          return;
        }
        setParams(decoded);
        engine.applyParams(decoded);
        setActiveMode('playground');
      });
    }

    const reportParam = query.get('report');
    if (reportParam) {
      handleReportParam(reportParam);
    }

    const assignParam = query.get('assignment');
    if (assignParam) {
      handleAssignmentParam(assignParam, query.get('tasks') || undefined);
    }

    // 2. window.serverParams (injected global object from server templates)
    const serverParams = (window as any).serverParams;
    if (serverParams && typeof serverParams === 'object') {
      const rep = serverParams.report || serverParams.parameter?.report || serverParams.parameters?.report?.[0];
      if (rep) handleReportParam(rep);

      const assign = serverParams.assignment || serverParams.parameter?.assignment || serverParams.parameters?.assignment?.[0];
      const tasks = serverParams.tasks || serverParams.parameter?.tasks || serverParams.parameters?.tasks?.[0];
      if (assign) handleAssignmentParam(assign, tasks);
    }

    // 3. google.script.url.getLocation() (native Google Apps Script client API)
    const googleScript = (window as any).google?.script;
    if (googleScript?.url?.getLocation) {
      try {
        googleScript.url.getLocation((location: any) => {
          const rep = location?.parameter?.report || location?.parameters?.report?.[0];
          if (rep) {
            handleReportParam(rep);
          }
          const assign = location?.parameter?.assignment || location?.parameters?.assignment?.[0];
          const tasks = location?.parameter?.tasks || location?.parameters?.tasks?.[0];
          if (assign) {
            handleAssignmentParam(assign, tasks);
          }
        });
      } catch (e) {
        console.error('Error calling google.script.url.getLocation', e);
      }
    }
  }, [engine]);

  // Audio start on first user click anywhere
  const handleUserGesture = async () => {
    if (!audioStarted) {
      await engine.startAudioContext();
      setAudioStarted(true);
    }
  };

  // Param update dispatcher
  const handleParamChange = (key: keyof SynthParams, val: any) => {
    const updated = { [key]: val };
    setParams((prev) => ({ ...prev, ...updated }));
    engine.applyParams(updated);
  };

  const handleLoadPreset = (preset: Preset) => {
    setParams({ ...preset.params });
    engine.applyParams(preset.params);
  };

  const loadParams = (next: SynthParams) => {
    setParams({ ...next });
    engine.applyParams(next);
  };

  // ---------- Batch grading review: step through students' patches ----------
  const handleGradeBatch = async () => {
    setIsGrading(true);
    setBatchResult(await parseBatch(batchText));
    setIsGrading(false);
  };
  const showReviewAt = (order: number[], pos: number) => {
    const entry = batchResult?.entries[order[pos]];
    if (!entry) return;
    if (entry.patchParams) loadParams(entry.patchParams);
    setReview({ order, pos });
    // Bring the synth into view so the student's knob settings are visible.
    requestAnimationFrame(() =>
      document.getElementById('synth-hardware-rack')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    );
  };
  const handleStartReview = (order: number[], start: number) => {
    if (!review) setSavedParams(params); // remember the teacher's own patch
    setIsBatchOpen(false);
    showReviewAt(order, start);
  };
  const handleExitReview = () => {
    if (savedParams) loadParams(savedParams);
    setSavedParams(null);
    setReview(null);
  };
  const reviewEntry = review && batchResult ? batchResult.entries[review.order[review.pos]] : null;

  const handleRecordTaskScore = (taskId: string, taskTitle: string, score: number) => {
    setCompletedTasks((prev) => {
      const old = prev.find((t) => t.taskId === taskId);
      const filtered = prev.filter((t) => t.taskId !== taskId);
      if (isPatchMaster(taskId)) {
        // Patch Master: keep the best match (it sets half the grade) and count every try.
        return [
          ...filtered,
          { taskId, taskTitle, score: Math.max(score, old?.score ?? 0), tries: (old?.tries ?? 0) + 1 },
        ];
      }
      return [...filtered, { taskId, taskTitle, score }];
    });
  };

  return (
    <div
      onClick={handleUserGesture}
      className={`min-h-screen transition-colors ${
        theme === 'hardware-bench' ? 'bg-[#0f1318]' : 'bg-[#0a0c10]'
      } text-slate-100 flex flex-col justify-between`}
    >
      {/* Top Header & App Bar */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-black/70 border-b border-white/10 px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Brand & Subtractive Lab Title */}
          <div className="flex items-center gap-3">
            <MarbleWaveLogo size={48} />
            <h1 className="text-base sm:text-lg font-bold tracking-wider font-mono text-white">
              SUBTRACTIVE SYNTHESIS LAB
            </h1>
          </div>

          {/* Core Four Modes Navigation Bar */}
          <nav className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-white/10">
            <button
              type="button"
              onClick={() => setActiveMode('learn')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase transition-all flex items-center gap-1.5 ${
                activeMode === 'learn'
                  ? 'bg-amber-500 text-black shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Learn</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveMode('playground')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase transition-all flex items-center gap-1.5 ${
                activeMode === 'playground'
                  ? 'bg-amber-500 text-black shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Gamepad2 className="w-3.5 h-3.5" />
              <span>Playground</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveMode('challenges')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase transition-all flex items-center gap-1.5 ${
                activeMode === 'challenges'
                  ? 'bg-amber-500 text-black shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>Challenges</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveMode('teacher')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase transition-all flex items-center gap-1.5 ${
                activeMode === 'teacher'
                  ? 'bg-amber-500 text-black shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Grade Report</span>
            </button>
          </nav>

          {/* Theme Quick Toggle & Audio Status */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setTheme(theme === 'studio-retro' ? 'hardware-bench' : 'studio-retro')
              }
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all border flex items-center gap-1.5 ${
                theme === 'hardware-bench'
                  ? 'bg-slate-300 text-slate-900 border-white/60 shadow-sm'
                  : 'bg-slate-800 text-amber-300 border-amber-500/30'
              }`}
              title="Switch hardware GUI theme"
            >
              <Palette className="w-3.5 h-3.5" />
              <span>{theme === 'studio-retro' ? 'Retro Synth' : 'Modern Synth'}</span>
            </button>

            {/* Audio Engine Status */}
            <div
              className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono border ${
                audioStarted
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
              }`}
            >
              {audioStarted ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
              <span>{audioStarted ? 'Audio Ready' : 'Click to Enable'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main App Workspace */}
      <main className="max-w-7xl w-full mx-auto px-3 sm:px-4 py-4 flex-1 space-y-4">
        {/* Mode A: Guided Walkthrough Overlay */}
        {activeMode === 'learn' && (
          <ModeLearn
            engine={engine}
            theme={theme}
            params={params}
            onThemeChange={(newTheme) => setTheme(newTheme)}
            onParamChange={handleParamChange}
          />
        )}

        {/* Mode B: The Playground Rack */}
        {activeMode === 'playground' && (
          <ModePlayground
            engine={engine}
            params={params}
            theme={theme}
            onThemeToggle={() =>
              setTheme(theme === 'studio-retro' ? 'hardware-bench' : 'studio-retro')
            }
            onLoadPreset={handleLoadPreset}
            onParamChange={handleParamChange}
          />
        )}

        {/* Mode C: Challenge Quests */}
        {activeMode === 'challenges' && (
          <ModeChallenges
            engine={engine}
            params={params}
            theme={theme}
            onThemeChange={(newTheme) => setTheme(newTheme)}
            onLoadParams={(newParams) => {
              setParams({ ...newParams });
              engine.applyParams(newParams);
            }}
            onRecordScore={handleRecordTaskScore}
          />
        )}

        {/* Mode D: Teacher Grade Report & Assignment Sharing */}
        {activeMode === 'teacher' && (
          <ModeTeacher
            currentParams={params}
            completedTasks={completedTasks}
            assignmentCodeFromUrl={assignmentCode}
            assignedTasks={assignedTasks}
            sharedReport={sharedReport}
            onLoadParams={loadParams}
            onOpenBatchGrade={() => setIsBatchOpen(true)}
          />
        )}

        {/* Primary Synthesizer Hardware Chassis (Active Theme) */}
        <section id="synth-hardware-rack" className="w-full scroll-mt-36">
          {theme === 'studio-retro' ? (
            <StudioRetroView
              params={params}
              engine={engine}
              onParamChange={handleParamChange}
              highlightKey={highlightSection}
            />
          ) : (
            <MinilogueView
              params={params}
              engine={engine}
              onParamChange={handleParamChange}
              highlightKey={highlightSection}
            />
          )}
        </section>

        {/* Virtual Keyboard Controller Dock */}
        <section id="synth-keyboard-section" className="w-full">
          <Keyboard engine={engine} theme={theme} params={params} />
        </section>
      </main>

      {/* Batch Grading */}
      <BatchGradeModal
        isOpen={isBatchOpen}
        onClose={() => setIsBatchOpen(false)}
        text={batchText}
        onTextChange={setBatchText}
        result={batchResult}
        isGrading={isGrading}
        onGrade={handleGradeBatch}
        onClear={() => {
          if (review) handleExitReview();
          setBatchResult(null);
          setBatchText('');
        }}
        onReview={handleStartReview}
      />
      {reviewEntry && review && !isBatchOpen && (
        <BatchReviewBar
          entry={reviewEntry}
          position={review.pos}
          total={review.order.length}
          onPrev={() => showReviewAt(review.order, review.pos - 1)}
          onNext={() => showReviewAt(review.order, review.pos + 1)}
          onBackToList={() => setIsBatchOpen(true)}
          onExit={handleExitReview}
        />
      )}
    </div>
  );
}
