import { SynthParams, BriefWork, StudentSubmission } from '../types';
import { DEFAULT_SYNTH_PARAMS } from './presets';
import { LEARN_STEPS } from './learnSteps';
import { PHRASES } from './playback';
import { taskTitle } from './taskCatalog';

/**
 * Autosave: keeps a student's work in THEIR OWN browser (localStorage) so closing the tab or reloading
 * doesn't lose it. Nothing is sent anywhere, and the student's name is never saved (it lives only inside
 * the submission code). The submission code is still the only thing a student hands in.
 */

export interface WorkSnapshot {
  tasks: StudentSubmission['completedTasks'];
  briefs: Record<string, BriefWork>;
  /** Missions finished per Learn step. */
  learnDone: number[];
}

const KEY = 'synthlab:v1:autosave';
const VERSION = 1;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const clampNum = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.slice(0, max) : undefined);

// ---------- Cleaning (anything read back from storage is checked before it is used) ----------
const WAVES = ['sine', 'triangle', 'sawtooth', 'square', 'noise'];
const LFO_WAVES = ['sine', 'triangle', 'sawtooth', 'square'];
const LFO_DESTS = ['pitch', 'cutoff', 'pwm'];

function cleanParams(raw: unknown): SynthParams {
  const out: Record<string, unknown> = { ...DEFAULT_SYNTH_PARAMS };
  if (!isObj(raw)) return out as unknown as SynthParams;
  for (const [k, def] of Object.entries(DEFAULT_SYNTH_PARAMS)) {
    const v = raw[k];
    if (typeof def === 'number' && typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  }
  if (typeof raw.vco1Waveform === 'string' && WAVES.includes(raw.vco1Waveform)) out.vco1Waveform = raw.vco1Waveform;
  if (typeof raw.vco2Waveform === 'string' && WAVES.includes(raw.vco2Waveform)) out.vco2Waveform = raw.vco2Waveform;
  if (typeof raw.lfoWaveform === 'string' && LFO_WAVES.includes(raw.lfoWaveform)) out.lfoWaveform = raw.lfoWaveform;
  if (typeof raw.lfoDestination === 'string' && LFO_DESTS.includes(raw.lfoDestination)) out.lfoDestination = raw.lfoDestination;
  if (raw.filterRolloff === -12 || raw.filterRolloff === -24) out.filterRolloff = raw.filterRolloff;
  if (raw.voiceMode === 'poly' || raw.voiceMode === 'mono') out.voiceMode = raw.voiceMode;
  return out as unknown as SynthParams;
}

function cleanSnapshot(raw: unknown): WorkSnapshot | null {
  if (!isObj(raw)) return null;

  const tasks: WorkSnapshot['tasks'] = [];
  const seen = new Set<string>();
  if (Array.isArray(raw.tasks)) {
    for (const t of raw.tasks) {
      if (!isObj(t) || typeof t.taskId !== 'string' || !t.taskId || seen.has(t.taskId)) continue;
      seen.add(t.taskId);
      const tries = clampNum(t.tries, 0, 1000, 0);
      tasks.push({
        taskId: t.taskId,
        taskTitle: text(t.taskTitle, 200) ?? taskTitle(t.taskId),
        score: clampNum(t.score, 0, 1000, 0),
        ...(tries ? { tries: Math.round(tries) } : {}),
      });
    }
  }

  const briefs: Record<string, BriefWork> = {};
  if (isObj(raw.briefs)) {
    for (const [id, w] of Object.entries(raw.briefs)) {
      if (!isObj(w)) continue;
      const phrase = typeof w.phrase === 'string' && w.phrase in PHRASES ? (w.phrase as BriefWork['phrase']) : undefined;
      const note = text(w.note, 2000);
      const name = text(w.name, 200);
      const base = text(w.base, 200);
      briefs[id] = {
        params: cleanParams(w.params),
        hints: Math.round(clampNum(w.hints, 0, 2, 0)),
        ...(note ? { note } : {}),
        ...(name ? { name } : {}),
        ...(base ? { base } : {}),
        ...(phrase ? { phrase } : {}),
      };
    }
  }

  const learnDone = LEARN_STEPS.map((s, i) =>
    Math.round(clampNum(Array.isArray(raw.learnDone) ? raw.learnDone[i] : 0, 0, s.missions.length, 0))
  );

  return { tasks, briefs, learnDone };
}

/** Used so an empty, brand-new session never overwrites a good save. */
export const hasWork = (s: WorkSnapshot): boolean =>
  s.tasks.length > 0 || Object.keys(s.briefs).length > 0 || s.learnDone.some((n) => n > 0);

// ---------- Storage (every call is wrapped: storage can be blocked, full, or wiped) ----------
export function loadSaved(): { snapshot: WorkSnapshot; savedAt: number } | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isObj(parsed) || parsed.v !== VERSION) return null;
    const snapshot = cleanSnapshot(parsed.data);
    if (!snapshot || !hasWork(snapshot)) return null;
    return { snapshot, savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : Date.now() };
  } catch {
    return null;
  }
}

/** Returns true if the save worked. */
export function writeSaved(snapshot: WorkSnapshot): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ v: VERSION, savedAt: Date.now(), data: snapshot }));
    return true;
  } catch {
    return false;
  }
}

export function clearSaved(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}
