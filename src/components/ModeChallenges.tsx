import React, { useState, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  SynthParams,
  PatchMatcherChallenge,
  SynthDoctorTicket,
  BlindTestChallenge,
  ThemeMode,
} from '../types';
import { SubtractiveEngine } from '../audio/synthEngine';
import {
  PATCH_MATCHER_CHALLENGES,
  SYNTH_DOCTOR_TICKETS,
  BLIND_TEST_CHALLENGES,
} from '../utils/presets';
import {
  Volume2,
  Stethoscope,
  Target,
  Ear,
  CheckCircle,
  AlertCircle,
  Trophy,
  RotateCcw,
  Sparkles,
  ArrowRight,
  HelpCircle,
  Lightbulb,
} from 'lucide-react';

export const HINTS_PER_PATCH = 2;

const SMOOTH_WAVES = ['sine', 'triangle'];
/** Round to a friendly number: 1 or 2 significant figures (e.g. 1,234 -> 1,200; 0.37 -> 0.4). */
const nice = (n: number) => {
  if (n <= 0) return 0;
  const digits = n >= 10 ? 2 : 1;
  return Number(n.toPrecision(digits));
};
const fmtTime = (s: number) => (s < 1 ? `${Math.round(nice(s * 1000))} ms` : `${nice(s)} s`);
const fmtHz = (n: number) => `${nice(n).toLocaleString()} Hz`;

/**
 * A vague clue for one setting: "should be above 3", "below 1,500 Hz", "between 2 & 5 Hz".
 * Points the student the right way from where their knob is now, without the exact value.
 */
function rangeClue(
  name: string,
  current: number,
  lo: number,
  hi: number,
  fmt: (n: number) => string,
  words: { up: string; down: string } = { up: 'above', down: 'below' }
): string {
  if (current < lo) return `${name} should be ${words.up} ${fmt(lo)}.`;
  if (current > hi) return `${name} should be ${words.down} ${fmt(hi)}.`;
  return `${name} should be between ${fmt(lo)} & ${fmt(hi)}.`;
}

/**
 * Patch Master hint: pick the setting the student is furthest from right now
 * (using the auto-grader's weights), skipping ones already hinted, and give a
 * range for it rather than the exact value.
 */
function patchHint(current: SynthParams, target: SynthParams, alreadyShown: string[]): { key: string; text: string } | null {
  const logGap = (a: number, b: number, span: number) => Math.min(1, Math.abs(Math.log10(Math.max(1e-3, a)) - Math.log10(Math.max(1e-3, b))) / span);
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const candidates = [
    {
      key: 'wave',
      gap: current.vco1Waveform === target.vco1Waveform ? 0 : 20,
      text:
        SMOOTH_WAVES.includes(target.vco1Waveform) === SMOOTH_WAVES.includes(current.vco1Waveform)
          ? `VCO 1 is the right kind of waveform (${SMOOTH_WAVES.includes(target.vco1Waveform) ? 'smooth' : 'buzzy'}), but not the right one. Try its partner.`
          : SMOOTH_WAVES.includes(target.vco1Waveform)
          ? 'VCO 1 needs a smooth, mellow waveform (not a buzzy one).'
          : 'VCO 1 needs a bright, buzzy waveform (not a smooth one).',
    },
    {
      key: 'cutoff',
      gap: logGap(current.filterCutoff, target.filterCutoff, 1.5) * 25,
      text: rangeClue('Filter Cutoff', current.filterCutoff, target.filterCutoff / 1.6, target.filterCutoff * 1.6, fmtHz),
    },
    {
      key: 'resonance',
      gap: Math.min(1, Math.abs(current.filterResonance - target.filterResonance) / 15) * 15,
      text: rangeClue('Filter Resonance', current.filterResonance, target.filterResonance * 0.6, target.filterResonance * 1.5 + 0.5, (n) => `${nice(n)}`),
    },
    {
      key: 'attack',
      gap: Math.min(1, Math.abs(current.ampAttack - target.ampAttack) / 1.5) * 15,
      text: rangeClue('Amp Envelope Attack', current.ampAttack, target.ampAttack / 2, target.ampAttack * 2 + 0.005, fmtTime, {
        up: 'slower than',
        down: 'faster than',
      }),
    },
    {
      key: 'sustain',
      gap: Math.abs(current.ampSustain - target.ampSustain) * 15,
      text: rangeClue(
        'Amp Envelope Sustain',
        current.ampSustain,
        Math.max(0, Math.floor((target.ampSustain - 0.15) * 10) / 10),
        Math.min(1, Math.ceil((target.ampSustain + 0.15) * 10) / 10),
        pct
      ),
    },
    // Not auto-graded, but they shape the sound a lot on some patches.
    {
      key: 'release',
      gap: logGap(current.ampRelease, target.ampRelease, 1.5) * 10,
      text: rangeClue('Amp Envelope Release', current.ampRelease, target.ampRelease / 2, target.ampRelease * 2, fmtTime, {
        up: 'longer than',
        down: 'shorter than',
      }),
    },
    {
      key: 'lfoRate',
      gap: target.lfoDepth >= 0.15 ? logGap(current.lfoRate, target.lfoRate, 1) * 15 : 0,
      text: `The LFO is a big part of this sound. LFO Rate should be between ${nice(Math.max(0.1, target.lfoRate * 0.6))} & ${nice(target.lfoRate * 1.5)} Hz.`,
    },
    {
      key: 'noise',
      gap: target.noiseLevel >= 0.2 ? Math.abs(current.noiseLevel - target.noiseLevel) * 15 : 0,
      text: rangeClue('White Noise level', current.noiseLevel, Math.max(0, target.noiseLevel - 0.2), Math.min(1, target.noiseLevel + 0.2), pct),
    },
  ];
  const next = candidates.filter((c) => c.gap >= 2 && !alreadyShown.includes(c.key)).sort((a, b) => b.gap - a.gap)[0];
  return next ? { key: next.key, text: next.text } : null;
}

interface ModeChallengesProps {
  engine: SubtractiveEngine;
  params: SynthParams;
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
  onLoadParams: (newParams: SynthParams) => void;
  onRecordScore?: (taskId: string, title: string, score: number) => void;
}

export const ModeChallenges: React.FC<ModeChallengesProps> = ({
  engine,
  params,
  theme,
  onThemeChange,
  onLoadParams,
  onRecordScore,
}) => {
  const [activeCategory, setActiveCategory] = useState<'matcher' | 'doctor' | 'blind'>('blind');

  // Patch Matcher State
  const [activePatchIdx, setActivePatchIdx] = useState<number>(0);
  const [matchScore, setMatchScore] = useState<number | null>(null);
  const [matchFeedback, setMatchFeedback] = useState<string | null>(null);
  // Hints given so far, per patch (kept for this visit only; nothing is saved).
  const [hintsByPatch, setHintsByPatch] = useState<Record<string, { key: string; text: string }[]>>({});
  const [noMoreHints, setNoMoreHints] = useState<string | null>(null);
  const currentPatchId = PATCH_MATCHER_CHALLENGES[activePatchIdx]?.id;
  const currentHints = hintsByPatch[currentPatchId] ?? [];
  const hintsLeft = HINTS_PER_PATCH - currentHints.length;
  const handleHint = () => {
    if (hintsLeft <= 0) return;
    const patch = PATCH_MATCHER_CHALLENGES[activePatchIdx];
    const next = patchHint(params, patch.targetParams, currentHints.map((h) => h.key));
    if (!next) {
      // Nothing far enough off to hint about; don't use up a hint.
      setNoMoreHints(patch.id);
      return;
    }
    setNoMoreHints(null);
    setHintsByPatch((prev) => ({ ...prev, [patch.id]: [...currentHints, next] }));
  };

  // Synth Doctor State
  const [activeTicketIdx, setActiveTicketIdx] = useState<number>(0);
  const [ticketStatus, setTicketStatus] = useState<'idle' | 'fixed' | 'failed'>('idle');
  const [ticketMessage, setTicketMessage] = useState<string | null>(null);
  const [showDoctorModal, setShowDoctorModal] = useState<boolean>(false);

  // Blind Ear Training State
  const [activeBlindIdx, setActiveBlindIdx] = useState<number>(0);
  const [blindSelected, setBlindSelected] = useState<'A' | 'B' | null>(null);
  const [blindResult, setBlindResult] = useState<boolean | null>(null);
  const [blindTotalScore, setBlindTotalScore] = useState<number>(0);

  // Playback interruption helper
  const playbackTimeoutsRef = useRef<NodeJS.Timeout[]>([]);

  const stopExistingPlayback = () => {
    playbackTimeoutsRef.current.forEach(clearTimeout);
    playbackTimeoutsRef.current = [];
    engine.allNotesOff();
    engine.applyParams(params);
  };

  // Reference Audio Player helper
  const playParamNotes = async (p: SynthParams, notes: string[], duration: number) => {
    stopExistingPlayback();
    await engine.startAudioContext();
    const originalParams = engine.getParams();

    // Temporarily apply target params
    engine.applyParams(p);

    notes.forEach((note, i) => {
      const t1 = setTimeout(() => {
        engine.noteOn(note, 0.85);
        const t2 = setTimeout(() => {
          engine.noteOff(note);
        }, duration * 800);
        playbackTimeoutsRef.current.push(t2);
      }, i * (duration * 1000));
      playbackTimeoutsRef.current.push(t1);
    });

    // Restore user params after playback
    const totalTime = notes.length * (duration * 1000) + 100;
    const t3 = setTimeout(() => {
      engine.applyParams(originalParams);
    }, totalTime);
    playbackTimeoutsRef.current.push(t3);
  };

  // Play Student's Current Sound
  const playCurrentSound = async (notes: string[], duration: number) => {
    stopExistingPlayback();
    await engine.startAudioContext();
    notes.forEach((note, i) => {
      const t1 = setTimeout(() => {
        engine.noteOn(note, 0.85);
        const t2 = setTimeout(() => {
          engine.noteOff(note);
        }, duration * 800);
        playbackTimeoutsRef.current.push(t2);
      }, i * (duration * 1000));
      playbackTimeoutsRef.current.push(t1);
    });
  };

  // 1. PATCH MATCHER ACCURACY CALCULATION
  const currentPatch = PATCH_MATCHER_CHALLENGES[activePatchIdx];

  const handleTestMatch = () => {
    const target = currentPatch.targetParams;
    let totalDifference = 0;
    let checkedFields = 0;

    // Compare waveform
    if (params.vco1Waveform === target.vco1Waveform) totalDifference += 0;
    else totalDifference += 20;
    checkedFields++;

    // Compare Cutoff (logarithmic difference)
    const logCutoffUser = Math.log10(Math.max(20, params.filterCutoff));
    const logCutoffTarget = Math.log10(Math.max(20, target.filterCutoff));
    const cutoffDiffPct = Math.min(1, Math.abs(logCutoffUser - logCutoffTarget) / 1.5);
    totalDifference += cutoffDiffPct * 25;
    checkedFields++;

    // Compare Resonance
    const resDiffPct = Math.min(1, Math.abs(params.filterResonance - target.filterResonance) / 15);
    totalDifference += resDiffPct * 15;
    checkedFields++;

    // Compare Amp Envelope Attack & Sustain
    const attackDiff = Math.min(1, Math.abs(params.ampAttack - target.ampAttack) / 1.5);
    const sustainDiff = Math.abs(params.ampSustain - target.ampSustain);
    totalDifference += (attackDiff * 15) + (sustainDiff * 15);
    checkedFields += 2;

    // Calculate score out of 100
    const calculatedScore = Math.max(0, Math.min(100, Math.round(100 - totalDifference)));
    setMatchScore(calculatedScore);

    if (calculatedScore >= 80) {
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      setMatchFeedback('Superb ear! You captured the harmonic character and contour within ±10% tolerance.');
    } else if (calculatedScore >= 55) {
      setMatchFeedback('Good effort! Check the hint below to get closer to the reference waveform or envelope.');
    } else {
      setMatchFeedback('Aural discrepancy detected. Listen closely to the reference and match the filter cutoff and sustain levels.');
    }

    if (onRecordScore) {
      onRecordScore(currentPatch.id, `Patch Matcher: ${currentPatch.title}`, calculatedScore);
    }
  };

  // 2. SYNTH DOCTOR VALIDATION
  const currentTicket = SYNTH_DOCTOR_TICKETS[activeTicketIdx];

  const handleLoadTicket = (idx: number) => {
    setActiveTicketIdx(idx);
    const t = SYNTH_DOCTOR_TICKETS[idx];
    onLoadParams({ ...t.brokenParams });
    onThemeChange(t.recommendedTheme);
    setTicketStatus('idle');
    setTicketMessage(null);
  };

  const handleSubmitFix = () => {
    const key = currentTicket.paramKey;
    const userVal = params[key];
    let isFixed = false;

    if (currentTicket.targetMin !== undefined && typeof userVal === 'number') {
      isFixed = userVal >= currentTicket.targetMin;
    } else if (currentTicket.targetMax !== undefined && typeof userVal === 'number') {
      isFixed = userVal <= currentTicket.targetMax;
    } else if (currentTicket.targetValue !== undefined) {
      isFixed = userVal === currentTicket.targetValue;
    }

    if (isFixed) {
      setTicketStatus('fixed');
      setTicketMessage(currentTicket.fixExplanation);
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      if (onRecordScore) {
        onRecordScore(currentTicket.id, `Synth Doctor: #${currentTicket.ticketNumber} ${currentTicket.title}`, 100);
      }
    } else {
      setTicketStatus('failed');
      setTicketMessage(
        `Not quite resolved yet! Re-read the diagnostic clue: "${currentTicket.diagnosticClue}"`
      );
    }
  };

  // 3. BLIND EAR TRAINING LOGIC
  const currentBlind = BLIND_TEST_CHALLENGES[activeBlindIdx];

  const handleSelectBlindOption = (option: 'A' | 'B') => {
    setBlindSelected(option);
    const isCorrect = option === currentBlind.correctOption;
    setBlindResult(isCorrect);
    if (isCorrect) {
      setBlindTotalScore((prev) => prev + 1);
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
    }
    if (onRecordScore) {
      onRecordScore(currentBlind.id, `Blind Ear Test: ${currentBlind.question}`, isCorrect ? 100 : 0);
    }
  };

  const handleNextBlind = () => {
    setBlindSelected(null);
    setBlindResult(null);
    setActiveBlindIdx((prev) => (prev + 1) % BLIND_TEST_CHALLENGES.length);
  };

  return (
    <div id="mode-challenges-panel" className="mb-4 space-y-3">
      {/* Category Tab Selector */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#121419] border border-[#262c37] p-2 shadow-lg">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveCategory('blind')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase transition-all flex items-center gap-1.5 ${
              activeCategory === 'blind'
                ? 'bg-cyan-500 text-black shadow-[0_0_12px_#06b6d4]'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Ear className="w-4 h-4" />
            1. A/B Ear Training
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveCategory('doctor');
              handleLoadTicket(activeTicketIdx);
              setShowDoctorModal(true);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase transition-all flex items-center gap-1.5 ${
              activeCategory === 'doctor'
                ? 'bg-emerald-500 text-black shadow-[0_0_12px_#10b981]'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Stethoscope className="w-4 h-4" />
            2. Synth Doctor
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('matcher')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase transition-all flex items-center gap-1.5 ${
              activeCategory === 'matcher'
                ? 'bg-amber-500 text-black shadow-[0_0_12px_#f59e0b]'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Target className="w-4 h-4" />
            3. Patch Master
          </button>
        </div>
      </div>

      {/* --- SUB-VIEW 1: PATCH MATCHER --- */}
      {activeCategory === 'matcher' && (
        <div className="rounded-xl bg-gradient-to-r from-amber-950/30 via-slate-900 to-slate-900 border border-amber-500/30 p-4 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/10 pb-3 mb-3">
            <div>
              <span className="text-[10px] font-mono text-amber-400 uppercase tracking-widest font-bold">
                QUEST 3: PATCH MASTER
                <span className="ml-2 normal-case tracking-normal text-sky-300 font-normal">
                  · graded on effort: every patch you try with Test Match counts
                </span>
              </span>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>{currentPatch.title}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
                  {currentPatch.difficulty}
                </span>
                <button
                  type="button"
                  onClick={handleHint}
                  disabled={hintsLeft <= 0}
                  title={
                    hintsLeft > 0
                      ? `Get a clue about the setting you're furthest from right now (${hintsLeft} of ${HINTS_PER_PATCH} left for this patch)`
                      : 'No hints left for this patch. Trust your ears!'
                  }
                  className={`ml-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold flex items-center gap-1 ${
                    hintsLeft > 0
                      ? 'bg-yellow-300 hover:bg-yellow-200 text-black shadow-[0_0_14px_rgba(253,224,71,0.8)] animate-pulse hover:animate-none'
                      : 'bg-slate-800 text-slate-500 border border-white/10 cursor-not-allowed'
                  }`}
                >
                  <Lightbulb className="w-3.5 h-3.5" />
                  {hintsLeft > 0 ? `Hint (${hintsLeft} left)` : 'No hints left'}
                </button>
              </h3>
            </div>

            {/* Patch Selector Buttons & Next Button */}
            <div className="flex items-center gap-1.5">
              {PATCH_MATCHER_CHALLENGES.map((p, idx) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setActivePatchIdx(idx);
                    setMatchScore(null);
                    setMatchFeedback(null);
                  }}
                  className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-all ${
                    idx === activePatchIdx
                      ? 'bg-amber-500 text-black'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  #{idx + 1}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setActivePatchIdx((prev) => (prev + 1) % PATCH_MATCHER_CHALLENGES.length);
                  setMatchScore(null);
                  setMatchFeedback(null);
                }}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-mono font-bold flex items-center gap-1 border border-white/10"
              >
                Next <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {(currentHints.length > 0 || noMoreHints === currentPatch.id) && (
            <div className="mb-3 p-3 rounded-lg bg-yellow-300/10 border border-yellow-300/50 text-xs text-yellow-100 space-y-1.5 shadow-[0_0_12px_rgba(253,224,71,0.15)]">
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

          {/* Audio Reference vs My Synth Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-black/40 border border-white/10 mb-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  playParamNotes(
                    currentPatch.targetParams,
                    currentPatch.referenceNotes,
                    currentPatch.referenceDuration
                  )
                }
                className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold font-mono text-xs flex items-center gap-2 shadow-[0_0_12px_rgba(245,158,11,0.3)] active:scale-95"
              >
                <Volume2 className="w-4 h-4" />
                Play Hidden Reference Target
              </button>

              <button
                type="button"
                onClick={() =>
                  playCurrentSound(currentPatch.referenceNotes, currentPatch.referenceDuration)
                }
                className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs flex items-center gap-2 border border-white/10 active:scale-95"
              >
                <Volume2 className="w-4 h-4 text-amber-400" />
                Audition My Synth
              </button>
            </div>

            {/* Test Match Button */}
            <button
              type="button"
              onClick={handleTestMatch}
              className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold font-mono text-xs uppercase flex items-center gap-2 shadow-[0_0_12px_rgba(16,185,129,0.3)] active:scale-95"
            >
              <Trophy className="w-4 h-4" />
              Test Match (Auto-Grade)
            </button>
          </div>

          {/* Match Score Gauge / Feedback */}
          {matchScore !== null && (
            <div className="p-3 rounded-lg bg-black/60 border border-amber-500/40 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-mono text-slate-400 uppercase">Match Score</span>
                  <span
                    className={`text-2xl font-mono font-bold ${
                      matchScore >= 80
                        ? 'text-emerald-400'
                        : matchScore >= 50
                        ? 'text-amber-400'
                        : 'text-red-400'
                    }`}
                  >
                    {matchScore}%
                  </span>
                </div>
                <div className="text-xs text-slate-200">{matchFeedback}</div>
              </div>

              <div className="text-[11px] font-mono text-amber-300/80 bg-amber-500/10 px-3 py-1.5 rounded border border-amber-500/30">
                Hint: {currentPatch.hint}
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- SUB-VIEW 2: SYNTH DOCTOR --- */}
      {activeCategory === 'doctor' && (
        <div className="rounded-xl bg-gradient-to-r from-emerald-950/30 via-slate-900 to-slate-900 border border-emerald-500/30 p-4 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/10 pb-3 mb-3">
            <div>
              <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest font-bold">
                QUEST 2: SYNTH DOCTOR
              </span>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>
                  Ticket #{currentTicket.ticketNumber}: {currentTicket.title}
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                  Theme: {currentTicket.recommendedTheme === 'studio-retro' ? 'Retro Synth' : 'Modern Synth'}
                </span>
              </h3>
            </div>

            {/* Ticket Selector Carousel */}
            <div className="flex items-center gap-1">
              {SYNTH_DOCTOR_TICKETS.map((t, idx) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleLoadTicket(idx)}
                  className={`px-2 py-1 rounded text-xs font-mono font-bold transition-all ${
                    idx === activeTicketIdx
                      ? 'bg-emerald-500 text-black'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  #{idx + 1}
                </button>
              ))}
            </div>
          </div>

          {/* Client Complaint Box */}
          <div className="p-3 rounded-lg bg-black/40 border border-red-500/20 mb-3">
            <span className="text-[10px] font-mono text-red-400 uppercase font-bold block mb-1">
              Client Service Ticket Complaint:
            </span>
            <p className="text-xs text-slate-200 italic">"{currentTicket.clientComplaint}"</p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-black/30 border border-white/10 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-amber-300 font-mono font-semibold">
                Diagnostic Clue:
              </span>
              <span className="text-xs text-slate-300">{currentTicket.diagnosticClue}</span>
            </div>

            <div className="flex items-center gap-2">
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
                className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold font-mono text-xs uppercase flex items-center gap-1.5 shadow-[0_0_12px_rgba(16,185,129,0.3)] active:scale-95"
              >
                <CheckCircle className="w-4 h-4" />
                Submit Fix
              </button>
            </div>
          </div>

          {/* Status Banner */}
          {ticketStatus !== 'idle' && (
            <div
              className={`p-3 rounded-lg border flex items-center justify-between gap-3 ${
                ticketStatus === 'fixed'
                  ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
                  : 'bg-red-950/60 border-red-500/50 text-red-200'
              }`}
            >
              <div className="flex items-center gap-3">
                {ticketStatus === 'fixed' ? (
                  <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                )}
                <div className="text-xs leading-relaxed">{ticketMessage}</div>
              </div>
              {ticketStatus === 'fixed' && (
                <button
                  type="button"
                  onClick={() => {
                    const nextIdx = (activeTicketIdx + 1) % SYNTH_DOCTOR_TICKETS.length;
                    handleLoadTicket(nextIdx);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold text-xs uppercase flex items-center gap-1 shadow-[0_0_10px_rgba(16,185,129,0.3)] flex-shrink-0"
                >
                  Next <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* --- SUB-VIEW 3: A/B BLIND EAR TRAINING --- */}
      {activeCategory === 'blind' && (
        <div className="rounded-xl bg-gradient-to-r from-cyan-950/30 via-slate-900 to-slate-900 border border-cyan-500/30 p-4 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/10 pb-3 mb-3">
            <div>
              <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest font-bold">
                QUEST 3: A/B BLIND EAR TRAINING • QUESTION {activeBlindIdx + 1} OF{' '}
                {BLIND_TEST_CHALLENGES.length}
              </span>
              <h3 className="text-base font-bold text-white mt-1">{currentBlind.question}</h3>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-400">Score:</span>
              <span className="text-sm font-mono font-bold text-cyan-400">
                {blindTotalScore} / {BLIND_TEST_CHALLENGES.length}
              </span>
            </div>
          </div>

          {/* A vs B Sound Triggers & Answers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4">
            {/* Tone A */}
            <div className="p-4 rounded-xl bg-black/40 border border-white/10 flex flex-col items-center justify-between gap-3">
              <button
                type="button"
                onClick={() =>
                  playParamNotes(currentBlind.optionA.params, [currentBlind.optionA.note], 1.2)
                }
                className="w-full py-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono font-bold text-sm flex items-center justify-center gap-2 shadow-[0_0_12px_rgba(6,182,212,0.3)] active:scale-95"
              >
                <Volume2 className="w-5 h-5" />
                Play Tone A
              </button>

              <button
                type="button"
                onClick={() => handleSelectBlindOption('A')}
                disabled={blindSelected !== null}
                className={`w-full py-2 rounded-lg font-mono text-xs font-bold transition-all ${
                  blindSelected === 'A'
                    ? currentBlind.correctOption === 'A'
                      ? 'bg-emerald-500 text-black'
                      : 'bg-red-500 text-white'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10'
                }`}
              >
                Choose Tone A
              </button>
            </div>

            {/* Tone B */}
            <div className="p-4 rounded-xl bg-black/40 border border-white/10 flex flex-col items-center justify-between gap-3">
              <button
                type="button"
                onClick={() =>
                  playParamNotes(currentBlind.optionB.params, [currentBlind.optionB.note], 1.2)
                }
                className="w-full py-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono font-bold text-sm flex items-center justify-center gap-2 shadow-[0_0_12px_rgba(6,182,212,0.3)] active:scale-95"
              >
                <Volume2 className="w-5 h-5" />
                Play Tone B
              </button>

              <button
                type="button"
                onClick={() => handleSelectBlindOption('B')}
                disabled={blindSelected !== null}
                className={`w-full py-2 rounded-lg font-mono text-xs font-bold transition-all ${
                  blindSelected === 'B'
                    ? currentBlind.correctOption === 'B'
                      ? 'bg-emerald-500 text-black'
                      : 'bg-red-500 text-white'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10'
                }`}
              >
                Choose Tone B
              </button>
            </div>
          </div>

          {/* Blind Explanation & Next Question */}
          {blindResult !== null && (
            <div className="p-3 rounded-lg bg-black/60 border border-cyan-500/40 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                {blindResult ? (
                  <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                )}
                <div className="text-xs text-slate-200">
                  <span className="font-bold mr-1">
                    {blindResult ? 'Correct!' : `Incorrect! Correct was Tone ${currentBlind.correctOption}.`}
                  </span>
                  {currentBlind.explanation}
                </div>
              </div>

              <button
                type="button"
                onClick={handleNextBlind}
                className="px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-bold text-xs flex items-center gap-1 active:scale-95 flex-shrink-0"
              >
                <span>Next</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Synth Doctor Instructions Modal */}
      {showDoctorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl bg-slate-950 border-2 border-emerald-500/50 p-6 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400">
                <Stethoscope className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest font-bold">
                  QUEST INSTRUCTIONS
                </span>
                <h3 className="text-base font-bold text-white">How to Test Synth Doctor Patches</h3>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              To diagnose and hear the broken synth patch, you must play notes on the keyboard!
            </p>

            <div className="p-3 rounded-lg bg-slate-900/90 border border-white/10 space-y-2 text-xs font-mono text-slate-200">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">1</span>
                <span>Use your computer typing keyboard (A-K keys)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">2</span>
                <span>Or click the on-screen keyboard keys</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">3</span>
                <span>Or plug in any USB/MIDI hardware keyboard</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowDoctorModal(false)}
              className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold text-xs uppercase shadow-[0_0_15px_rgba(16,185,129,0.4)] active:scale-95 transition-all"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
