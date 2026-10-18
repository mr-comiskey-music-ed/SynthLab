import React, { useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { SynthParams, ThemeMode, BriefWork } from '../types';
import { SubtractiveEngine } from '../audio/synthEngine';
import { PATCH_MATCHER_CHALLENGES, SYNTH_DOCTOR_TICKETS, BLIND_TEST_CHALLENGES } from '../utils/presets';
import { scorePatch, nextPatchHint, AspectResult } from '../utils/patchScore';
import { playPhrase, stopPhrase } from '../utils/playback';
import { PatchParamList } from './PatchParamList';
import { ModeBriefs } from './ModeBriefs';
import { ModeMyPresets } from './ModeMyPresets';
import { QuestComplete } from './QuestComplete';
import {
  Volume2,
  Stethoscope,
  Target,
  Ear,
  CheckCircle,
  AlertCircle,
  Trophy,
  RotateCcw,
  ArrowRight,
  Lightbulb,
  Eye,
  Palette,
  Lock,
  Library,
} from 'lucide-react';

export const HINTS_PER_PATCH = 4;
/** Tries before a student may reveal a Patch Master answer. */
export const TRIES_BEFORE_REVEAL = 3;
/** Points a Synth Doctor fix loses for each clue opened. */
export const DOCTOR_CLUE_COST = 5;

type Category = 'blind' | 'doctor' | 'matcher' | 'design' | 'mine';

interface ModeChallengesProps {
  engine: SubtractiveEngine;
  params: SynthParams;
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
  onLoadParams: (newParams: SynthParams) => void;
  onRecordScore?: (taskId: string, title: string, score: number) => void;
  briefWork: Record<string, BriefWork>;
  onSaveBrief: (briefId: string, work: BriefWork) => void;
  onGoToPlayground?: () => void;
  onGoToReport?: () => void;
}

/** Swap "Tone A" and "Tone B" in an explanation when the two sides were shuffled. */
const swapToneLetters = (text: string) =>
  text.replace(/Tone A/g, '\u0000').replace(/Tone B/g, 'Tone A').replace(/\u0000/g, 'Tone B');

const gapColor = (gap: number) => (gap < 0.2 ? 'bg-emerald-400' : gap < 0.5 ? 'bg-amber-400' : 'bg-rose-400');
const gapWord = (gap: number) => (gap < 0.2 ? 'close' : gap < 0.5 ? 'getting there' : 'far off');

export const ModeChallenges: React.FC<ModeChallengesProps> = ({
  engine,
  params,
  onLoadParams,
  onRecordScore,
  briefWork,
  onSaveBrief,
  onGoToPlayground,
  onGoToReport,
}) => {
  const [activeCategory, setActiveCategory] = useState<Category>('blind');
  // The student's latest patch, for putting back after a reference sound plays.
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const restoreMine = () => paramsRef.current;

  // ---------------- 1. A/B ear training ----------------
  const [activeBlindIdx, setActiveBlindIdx] = useState(0);
  // Which questions show their tones the other way round (shuffled once per visit).
  const swapped = useMemo(() => BLIND_TEST_CHALLENGES.map(() => Math.random() < 0.5), []);
  // One answer per question; it can't be changed (nothing is saved after the page closes).
  const [blindAnswers, setBlindAnswers] = useState<Record<string, 'A' | 'B'>>({});
  const currentBlind = BLIND_TEST_CHALLENGES[activeBlindIdx];
  const isSwapped = swapped[activeBlindIdx];
  const shown = (side: 'A' | 'B') => (isSwapped ? (side === 'A' ? currentBlind.optionB : currentBlind.optionA) : side === 'A' ? currentBlind.optionA : currentBlind.optionB);
  const correctShown: 'A' | 'B' = isSwapped ? (currentBlind.correctOption === 'A' ? 'B' : 'A') : currentBlind.correctOption;
  const blindAnswer = blindAnswers[currentBlind.id];
  const blindCorrectCount = BLIND_TEST_CHALLENGES.filter((q, i) => {
    const a = blindAnswers[q.id];
    if (!a) return false;
    const c = swapped[i] ? (q.correctOption === 'A' ? 'B' : 'A') : q.correctOption;
    return a === c;
  }).length;
  const blindAnsweredCount = Object.keys(blindAnswers).length;

  const handleSelectBlind = (side: 'A' | 'B') => {
    if (blindAnswer) return;
    const isCorrect = side === correctShown;
    setBlindAnswers((prev) => ({ ...prev, [currentBlind.id]: side }));
    if (isCorrect) confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
    onRecordScore?.(currentBlind.id, `Blind Ear Test: ${currentBlind.question}`, isCorrect ? 100 : 0);
  };

  const playBlind = (side: 'A' | 'B') => {
    const opt = shown(side);
    playPhrase(engine, currentBlind.phrase, { params: opt.params, restore: restoreMine });
  };

  // ---------------- 2. Synth Doctor ----------------
  const [activeTicketIdx, setActiveTicketIdx] = useState(0);
  const [ticketStatus, setTicketStatus] = useState<'idle' | 'fixed' | 'failed'>('idle');
  const [cluesByTicket, setCluesByTicket] = useState<Record<string, number>>({});
  const [fixedTickets, setFixedTickets] = useState<Record<string, number>>({});
  const currentTicket = SYNTH_DOCTOR_TICKETS[activeTicketIdx];
  const cluesOpen = cluesByTicket[currentTicket.id] ?? 0;

  const handleLoadTicket = (idx: number) => {
    setActiveTicketIdx(idx);
    onLoadParams({ ...SYNTH_DOCTOR_TICKETS[idx].brokenParams });
    setTicketStatus('idle');
  };

  const openClue = () => {
    setCluesByTicket((prev) => ({ ...prev, [currentTicket.id]: Math.min(2, (prev[currentTicket.id] ?? 0) + 1) }));
  };

  const handleSubmitFix = () => {
    const t = currentTicket;
    const userVal = params[t.paramKey];
    let isFixed = false;
    if (t.targetValues) isFixed = t.targetValues.includes(userVal);
    else if (typeof userVal === 'number' && (t.targetMin !== undefined || t.targetMax !== undefined))
      isFixed = (t.targetMin === undefined || userVal >= t.targetMin) && (t.targetMax === undefined || userVal <= t.targetMax);
    else if (t.targetValue !== undefined) isFixed = userVal === t.targetValue;

    if (isFixed) {
      setTicketStatus('fixed');
      const score = 100 - DOCTOR_CLUE_COST * cluesOpen;
      if (fixedTickets[t.id] === undefined) {
        setFixedTickets((prev) => ({ ...prev, [t.id]: score }));
        onRecordScore?.(t.id, `Synth Doctor: #${t.ticketNumber} ${t.title}`, score);
      }
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
    } else {
      setTicketStatus('failed');
    }
  };

  // ---------------- 3. Patch Master ----------------
  const [activePatchIdx, setActivePatchIdx] = useState(0);
  const [lastResult, setLastResult] = useState<{ patchId: string; score: number; aspects: AspectResult[] } | null>(null);
  const [hintsByPatch, setHintsByPatch] = useState<Record<string, { key: string; text: string }[]>>({});
  const [noMoreHints, setNoMoreHints] = useState<string | null>(null);
  const [triesByPatch, setTriesByPatch] = useState<Record<string, number>>({});
  const [bestByPatch, setBestByPatch] = useState<Record<string, number>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const currentPatch = PATCH_MATCHER_CHALLENGES[activePatchIdx];
  const currentHints = hintsByPatch[currentPatch.id] ?? [];
  const hintsLeft = HINTS_PER_PATCH - currentHints.length;
  const tries = triesByPatch[currentPatch.id] ?? 0;
  const isRevealed = !!revealed[currentPatch.id];
  const result = lastResult?.patchId === currentPatch.id ? lastResult : null;

  // Each patch keeps the student's work-in-progress while they look at another one.
  const workByPatch = useRef<Record<string, SynthParams>>({});
  const loadPatch = (idx: number) => {
    const p = PATCH_MATCHER_CHALLENGES[idx];
    onLoadParams({ ...(workByPatch.current[p.id] ?? p.startParams) });
  };
  const choosePatch = (idx: number) => {
    workByPatch.current[currentPatch.id] = { ...params };
    stopPhrase();
    setActivePatchIdx(idx);
    setNoMoreHints(null);
    loadPatch(idx);
  };
  const restartPatch = () => {
    delete workByPatch.current[currentPatch.id];
    onLoadParams({ ...currentPatch.startParams });
    setNoMoreHints(null);
  };
  const allPatchesTried = PATCH_MATCHER_CHALLENGES.every((p) => bestByPatch[p.id] !== undefined);
  const isLastPatch = activePatchIdx === PATCH_MATCHER_CHALLENGES.length - 1;

  const handleHint = () => {
    if (hintsLeft <= 0) return;
    const next = nextPatchHint(params, currentPatch, currentHints.map((h) => h.key));
    if (!next) {
      setNoMoreHints(currentPatch.id);
      return;
    }
    setNoMoreHints(null);
    setHintsByPatch((prev) => ({ ...prev, [currentPatch.id]: [...currentHints, next] }));
  };

  const handleTestMatch = () => {
    const { score, aspects } = scorePatch(params, currentPatch);
    setLastResult({ patchId: currentPatch.id, score, aspects });
    setTriesByPatch((prev) => ({ ...prev, [currentPatch.id]: (prev[currentPatch.id] ?? 0) + 1 }));
    setBestByPatch((prev) => ({ ...prev, [currentPatch.id]: Math.max(score, prev[currentPatch.id] ?? 0) }));
    if (score >= 80) confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    // After the answer is revealed, matching it no longer counts.
    if (!isRevealed) onRecordScore?.(currentPatch.id, `Patch Matcher: ${currentPatch.title}`, score);
  };

  const playReference = () =>
    playPhrase(engine, currentPatch.phrase, {
      params: currentPatch.targetParams,
      restore: restoreMine,
    });
  const playMine = () => {
    engine.applyParams(params);
    playPhrase(engine, currentPatch.phrase);
  };

  const matchFeedback = (score: number) =>
    score >= 80
      ? 'Superb ear! That’s a close match.'
      : score >= 55
      ? 'Good progress. Check the bars below to see which parts are still off.'
      : 'Keep going. Listen to the reference again and focus on the parts marked “far off.”';

  // ---------------- Tabs ----------------
  const tabs: { id: Category; label: string; icon: React.ReactNode; on: string }[] = [
    { id: 'blind', label: '1. A/B Ear Training', icon: <Ear className="w-4 h-4" />, on: 'bg-cyan-500 text-black shadow-[0_0_12px_#06b6d4]' },
    { id: 'doctor', label: '2. Synth Doctor', icon: <Stethoscope className="w-4 h-4" />, on: 'bg-emerald-500 text-black shadow-[0_0_12px_#10b981]' },
    { id: 'mine', label: '3. My Presets', icon: <Library className="w-4 h-4" />, on: 'bg-violet-500 text-black shadow-[0_0_12px_#8b5cf6]' },
    { id: 'design', label: '4. Sound Design', icon: <Palette className="w-4 h-4" />, on: 'bg-fuchsia-500 text-black shadow-[0_0_12px_#d946ef]' },
    { id: 'matcher', label: '5. Patch Master', icon: <Target className="w-4 h-4" />, on: 'bg-amber-500 text-black shadow-[0_0_12px_#f59e0b]' },
  ];

  const selectTab = (id: Category) => {
    stopPhrase();
    if (activeCategory === 'matcher') workByPatch.current[currentPatch.id] = { ...params };
    setActiveCategory(id);
    if (id === 'doctor') handleLoadTicket(activeTicketIdx);
    if (id === 'matcher') loadPatch(activePatchIdx);
  };

  return (
    <div id="mode-challenges-panel" className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-[#121419] border border-[#262c37] p-2 shadow-lg">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => selectTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase transition-all flex items-center gap-1.5 ${
              activeCategory === t.id ? t.on : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* ---------------- 1. A/B ---------------- */}
      {activeCategory === 'blind' && (
        <div className="rounded-xl bg-gradient-to-r from-cyan-950/30 via-slate-900 to-slate-900 border border-cyan-500/30 p-4 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/10 pb-3 mb-3">
            <div>
              <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest font-bold">
                QUEST 1: A/B EAR TRAINING · QUESTION {activeBlindIdx + 1} OF {BLIND_TEST_CHALLENGES.length}
              </span>
              <h3 className="text-base font-bold text-white mt-1">{currentBlind.question}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Listen to both as many times as you like. You get one answer per question.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex gap-1" aria-label="Questions">
                {BLIND_TEST_CHALLENGES.map((q, i) => {
                  const a = blindAnswers[q.id];
                  const c = swapped[i] ? (q.correctOption === 'A' ? 'B' : 'A') : q.correctOption;
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setActiveBlindIdx(i)}
                      title={`Question ${i + 1}`}
                      className={`w-3 h-3 rounded-full ${i === activeBlindIdx ? 'ring-2 ring-cyan-300' : ''} ${
                        !a ? 'bg-slate-700' : a === c ? 'bg-emerald-400' : 'bg-rose-400'
                      }`}
                    />
                  );
                })}
              </div>
              <span className="text-sm font-mono font-bold text-cyan-400">
                {blindCorrectCount} / {blindAnsweredCount || 0}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4">
            {(['A', 'B'] as const).map((side) => (
              <div key={side} className="p-4 rounded-xl bg-black/40 border border-white/10 flex flex-col items-center gap-3">
                <button
                  type="button"
                  onClick={() => playBlind(side)}
                  className="w-full py-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono font-bold text-sm flex items-center justify-center gap-2 active:scale-95"
                >
                  <Volume2 className="w-5 h-5" />
                  Play Tone {side}
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectBlind(side)}
                  disabled={!!blindAnswer}
                  className={`w-full py-2 rounded-lg font-mono text-xs font-bold transition-all ${
                    blindAnswer === side
                      ? side === correctShown
                        ? 'bg-emerald-500 text-black'
                        : 'bg-red-500 text-white'
                      : blindAnswer && side === correctShown
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 disabled:opacity-50 disabled:hover:bg-slate-800'
                  }`}
                >
                  {blindAnswer && side === correctShown ? `Tone ${side} is the answer` : `Choose Tone ${side}`}
                </button>
              </div>
            ))}
          </div>

          {blindAnsweredCount === BLIND_TEST_CHALLENGES.length && (
            <QuestComplete
              quest="A/B Ear Training"
              tone="cyan"
              summary={`${blindCorrectCount} of ${BLIND_TEST_CHALLENGES.length} correct. Your ears are getting sharp!`}
              onGoToPlayground={onGoToPlayground}
              onGoToReport={onGoToReport}
            />
          )}

          {blindAnswer && (
            <div className="p-3 rounded-lg bg-black/60 border border-cyan-500/40 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                {blindAnswer === correctShown ? (
                  <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                )}
                <div className="text-xs text-slate-200">
                  <span className="font-bold mr-1">{blindAnswer === correctShown ? 'Correct!' : `Not quite. It was Tone ${correctShown}.`}</span>
                  {isSwapped ? swapToneLetters(currentBlind.explanation) : currentBlind.explanation}
                </div>
              </div>
              {activeBlindIdx < BLIND_TEST_CHALLENGES.length - 1 && (
                <button
                  type="button"
                  onClick={() => setActiveBlindIdx((i) => i + 1)}
                  className="px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-bold text-xs flex items-center gap-1 active:scale-95 flex-shrink-0"
                >
                  Next <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ---------------- 2. Synth Doctor ---------------- */}
      {activeCategory === 'doctor' && (
        <div className="rounded-xl bg-gradient-to-r from-emerald-950/30 via-slate-900 to-slate-900 border border-emerald-500/30 p-4 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/10 pb-3 mb-3">
            <div>
              <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest font-bold">QUEST 2: SYNTH DOCTOR</span>
              <h3 className="text-base font-bold text-white">
                Ticket #{currentTicket.ticketNumber}: {currentTicket.title}
              </h3>
            </div>
            <div className="flex items-center gap-1">
              {SYNTH_DOCTOR_TICKETS.map((t, idx) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleLoadTicket(idx)}
                  className={`px-2 py-1 rounded text-xs font-mono font-bold transition-all ${
                    idx === activeTicketIdx
                      ? 'bg-emerald-500 text-black'
                      : fixedTickets[t.id] !== undefined
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  #{idx + 1}
                </button>
              ))}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-black/40 border border-red-500/20 mb-3">
            <span className="text-[10px] font-mono text-red-400 uppercase font-bold block mb-1">The client says:</span>
            <p className="text-sm text-slate-200 italic">“{currentTicket.clientComplaint}”</p>
            <p className="text-[11px] text-slate-400 mt-2">
              Press <b className="text-slate-300">Play test phrase</b> (or play the keys) to hear the problem, find it on the synth, fix it, then
              Submit Fix. Each clue costs {DOCTOR_CLUE_COST} points on this ticket.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-black/30 border border-white/10 mb-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-amber-300 font-mono font-semibold flex items-center gap-1">
                <Lightbulb className="w-3.5 h-3.5" /> Clues
              </span>
              {cluesOpen < 2 && fixedTickets[currentTicket.id] === undefined && (
                <button
                  type="button"
                  onClick={openClue}
                  className="px-2.5 py-1 rounded-full bg-amber-400/90 hover:bg-amber-300 text-black text-[11px] font-mono font-bold"
                  title={`Each clue costs ${DOCTOR_CLUE_COST} points on this ticket`}
                >
                  {cluesOpen === 0 ? 'Clue 1: where to look' : 'Clue 2: which control'} (−{DOCTOR_CLUE_COST})
                </button>
              )}
              {cluesOpen === 0 && <span className="text-[11px] text-slate-500">Solve it without clues for full points.</span>}
            </div>
            {cluesOpen >= 1 && <p className="text-xs text-slate-200"><b className="text-amber-300 font-mono">1.</b> {currentTicket.sectionClue}</p>}
            {cluesOpen >= 2 && <p className="text-xs text-slate-200"><b className="text-amber-300 font-mono">2.</b> {currentTicket.diagnosticClue}</p>}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 mb-3">
            <button
              type="button"
              onClick={() => {
                engine.applyParams(params);
                playPhrase(engine, currentTicket.phrase);
              }}
              className="mr-auto px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-black font-bold font-mono text-xs flex items-center gap-1.5 active:scale-95"
              title="Plays your current patch, so you can hear the problem, and later the fix"
            >
              <Volume2 className="w-4 h-4" />
              Play test phrase
            </button>
            <button
              type="button"
              onClick={() => handleLoadTicket(activeTicketIdx)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1 border border-white/10"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reload Broken Patch
            </button>
            <button
              type="button"
              onClick={handleSubmitFix}
              className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold font-mono text-xs uppercase flex items-center gap-1.5 active:scale-95"
            >
              <CheckCircle className="w-4 h-4" />
              Submit Fix
            </button>
          </div>

          {ticketStatus !== 'idle' && (
            <div
              className={`p-3 rounded-lg border flex items-center justify-between gap-3 ${
                ticketStatus === 'fixed' ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200' : 'bg-red-950/60 border-red-500/50 text-red-200'
              }`}
            >
              <div className="flex items-center gap-3">
                {ticketStatus === 'fixed' ? (
                  <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                )}
                <div className="text-xs leading-relaxed">
                  {ticketStatus === 'fixed'
                    ? `${currentTicket.fixExplanation} (${fixedTickets[currentTicket.id] ?? 100} points)`
                    : cluesOpen < 2
                    ? 'Not fixed yet. Play some notes and listen again, or open a clue.'
                    : 'Not fixed yet. Re-read clue 2 and try that control again.'}
                </div>
              </div>
              {ticketStatus === 'fixed' && activeTicketIdx < SYNTH_DOCTOR_TICKETS.length - 1 && (
                <button
                  type="button"
                  onClick={() => handleLoadTicket(activeTicketIdx + 1)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold text-xs uppercase flex items-center gap-1 flex-shrink-0"
                >
                  Next <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {Object.keys(fixedTickets).length === SYNTH_DOCTOR_TICKETS.length && (
            <QuestComplete
              quest="Synth Doctor"
              tone="emerald"
              summary={`All ${SYNTH_DOCTOR_TICKETS.length} tickets fixed. The clinic is officially closed for the day!`}
              onGoToPlayground={onGoToPlayground}
              onGoToReport={onGoToReport}
            />
          )}
          {ticketStatus === 'fixed' &&
            activeTicketIdx === SYNTH_DOCTOR_TICKETS.length - 1 &&
            Object.keys(fixedTickets).length < SYNTH_DOCTOR_TICKETS.length && (
              <p className="mt-2 text-xs text-amber-200">
                That was the last ticket, but you skipped some. Use the numbered buttons above to go back and fix the rest.
              </p>
            )}
        </div>
      )}

      {/* ---------------- 3. Patch Master ---------------- */}
      {activeCategory === 'matcher' && (
        <div className="rounded-xl bg-gradient-to-r from-amber-950/30 via-slate-900 to-slate-900 border border-amber-500/30 p-4 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/10 pb-3 mb-3">
            <div>
              <span className="text-[10px] font-mono text-amber-400 uppercase tracking-widest font-bold">
                QUEST 5: PATCH MASTER
                <span className="ml-2 normal-case tracking-normal text-sky-300 font-normal">· you get 50% for trying. The other 50% is based on your scores</span>
              </span>
              <h3 className="text-base font-bold text-white flex flex-wrap items-center gap-2">
                <span>{currentPatch.title}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">{currentPatch.difficulty}</span>
                <button
                  type="button"
                  onClick={handleHint}
                  disabled={hintsLeft <= 0 || isRevealed}
                  title={hintsLeft > 0 ? `A clue about a setting that is still off right now (${hintsLeft} of ${HINTS_PER_PATCH} left)` : 'No hints left for this patch. Trust your ears!'}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold flex items-center gap-1 ${
                    hintsLeft > 0 && !isRevealed
                      ? 'bg-yellow-300 hover:bg-yellow-200 text-black'
                      : 'bg-slate-800 text-slate-500 border border-white/10 cursor-not-allowed'
                  }`}
                >
                  <Lightbulb className="w-3.5 h-3.5" />
                  {hintsLeft > 0 ? `Hint (${hintsLeft} left)` : 'No hints left'}
                </button>
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {PATCH_MATCHER_CHALLENGES.map((p, idx) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => choosePatch(idx)}
                  title={bestByPatch[p.id] !== undefined ? `Best so far: ${bestByPatch[p.id]}%` : p.title}
                  className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-all ${
                    idx === activePatchIdx
                      ? 'bg-amber-500 text-black'
                      : bestByPatch[p.id] !== undefined
                      ? 'bg-amber-500/20 text-amber-200'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  #{idx + 1}
                </button>
              ))}
            </div>
          </div>

          {(currentHints.length > 0 || noMoreHints === currentPatch.id) && (
            <div className="mb-3 p-3 rounded-lg bg-yellow-300/10 border border-yellow-300/50 text-xs text-yellow-100 space-y-1.5">
              {currentHints.map((h, i) => (
                <div key={h.key} className="flex items-start gap-2">
                  <Lightbulb className="w-4 h-4 text-yellow-300 shrink-0 mt-0.5" />
                  <span>
                    <b className="text-yellow-300 font-mono">Hint {i + 1}: </b>
                    {h.text}
                  </span>
                </div>
              ))}
              {noMoreHints === currentPatch.id && (
                <div className="flex items-start gap-2 text-yellow-200/80">
                  <Lightbulb className="w-4 h-4 text-yellow-300/60 shrink-0 mt-0.5" />
                  <span>You're already close on the main settings. No hint used: fine-tune by ear!</span>
                </div>
              )}
            </div>
          )}

          <p className="text-xs text-slate-300 mb-4">{currentPatch.description}</p>

          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-black/40 border border-white/10 mb-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={playReference}
                className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold font-mono text-xs flex items-center gap-2 active:scale-95"
              >
                <Volume2 className="w-4 h-4" />
                Play the Target
              </button>
              <button
                type="button"
                onClick={playMine}
                className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs flex items-center gap-2 border border-white/10 active:scale-95"
              >
                <Volume2 className="w-4 h-4 text-amber-400" />
                Play My Synth
              </button>
            </div>
            <div className="flex items-center gap-2">
              {tries > 0 && <span className="text-[11px] font-mono text-slate-400">{tries} {tries === 1 ? 'try' : 'tries'} · best {bestByPatch[currentPatch.id]}%</span>}
              <button
                type="button"
                onClick={restartPatch}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs flex items-center gap-1.5 border border-white/10"
                title="Put the synth back to this patch's starting point"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Restart patch
              </button>
              <button
                type="button"
                onClick={handleTestMatch}
                className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold font-mono text-xs uppercase flex items-center gap-2 active:scale-95"
              >
                <Trophy className="w-4 h-4" />
                Test Match
              </button>
            </div>
          </div>

          {result && (
            <div className="p-3 rounded-lg bg-black/60 border border-amber-500/40 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-center shrink-0">
                  <span className="text-[10px] font-mono text-slate-400 uppercase">Match</span>
                  <span className={`text-2xl font-mono font-bold ${result.score >= 80 ? 'text-emerald-400' : result.score >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                    {result.score}%
                  </span>
                </div>
                <div className="text-xs text-slate-200">{matchFeedback(result.score)}</div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                {[...result.aspects]
                  .sort((a, b) => b.weight - a.weight)
                  .map((a) => (
                    <div key={a.aspect} className="flex items-center gap-2 text-[11px] font-mono">
                      <span className="w-40 shrink-0 text-slate-300 truncate">{a.label}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div className={`h-full ${gapColor(a.gap)}`} style={{ width: `${Math.max(6, Math.round((1 - a.gap) * 100))}%` }} />
                      </div>
                      <span className="w-20 shrink-0 text-right text-slate-400">{gapWord(a.gap)}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {tries > 0 && !isLastPatch && (
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => choosePatch(activePatchIdx + 1)}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-mono font-bold text-xs uppercase flex items-center gap-1.5 active:scale-95"
              >
                Next patch <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {allPatchesTried && (
            <QuestComplete
              quest="Patch Master"
              tone="amber"
              summary={`You matched all ${PATCH_MATCHER_CHALLENGES.length} patches.`}
              onGoToPlayground={onGoToPlayground}
              onGoToReport={onGoToReport}
            />
          )}

          {tries >= TRIES_BEFORE_REVEAL && !isRevealed && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-white/5 border border-white/10 text-[11px] text-slate-300">
              <span className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                Stuck? You can see the answer. Your best score so far ({bestByPatch[currentPatch.id]}%) stays, but new tries won't count.
              </span>
              <button
                type="button"
                onClick={() => setRevealed((prev) => ({ ...prev, [currentPatch.id]: true }))}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/15 font-mono font-bold text-slate-200 flex items-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5" /> Reveal the answer
              </button>
            </div>
          )}

          {isRevealed && (
            <div className="mt-3 p-3 rounded-lg bg-sky-950/40 border border-sky-500/40 space-y-2">
              <div className="text-xs text-sky-200">
                <b>The target patch.</b> {currentPatch.hint} Highlighted settings are the ones different from yours.
              </div>
              <PatchParamList params={currentPatch.targetParams} compareTo={params} />
              <button
                type="button"
                onClick={() => onLoadParams({ ...currentPatch.targetParams })}
                className="px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-200 font-mono font-bold text-[11px]"
              >
                Load it on the synth to study it
              </button>
            </div>
          )}
        </div>
      )}

      {/* ---------------- 4. Sound Design ---------------- */}
      {activeCategory === 'design' && (
        <ModeBriefs
          engine={engine}
          params={params}
          briefWork={briefWork}
          onSaveBrief={onSaveBrief}
          onLoadParams={onLoadParams}
          onGoToPlayground={onGoToPlayground}
          onGoToReport={onGoToReport}
        />
      )}

      {/* ---------------- 5. My Presets ---------------- */}
      {activeCategory === 'mine' && (
        <ModeMyPresets
          engine={engine}
          params={params}
          saved={briefWork}
          onSave={onSaveBrief}
          onLoadParams={onLoadParams}
          onGoToPlayground={onGoToPlayground}
          onGoToReport={onGoToReport}
        />
      )}

    </div>
  );
};
