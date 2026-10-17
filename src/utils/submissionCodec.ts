import { SynthParams, StudentSubmission, BriefWork } from '../types';
import { DEFAULT_SYNTH_PARAMS } from './presets';
import { taskTitle, gradesFor, headlineScore, cleanTaskList } from './taskCatalog';

/**
 * Compact submission and patch codes.
 *
 * Before compression the work is packed into a small structure:
 *   - only synth settings that differ from the default patch are kept
 *   - short keys replace long setting names, numbers keep 4 significant digits
 *   - task titles and the total score are left out (rebuilt from the task list)
 * The packed JSON is compressed with the browser's built-in deflate
 * (CompressionStream), so no extra library is needed.
 *
 * Submission code:  <compressed>.<checksum>
 * Patch code:       <compressed>
 *
 * Older codes (plain base64 JSON) still decode, so codes students already
 * turned in keep working. Nothing leaves the browser.
 *
 * Format version 2 (marked "v": 2) changed two meanings:
 *   - Pulse width is now the duty cycle (0.5 = square). Before, 0 was square.
 *   - The default LFO depth is now 0 (it was 0.05).
 * Codes without the mark are converted when they're read.
 */
const FORMAT_VERSION = 2;

export const DEFAULT_ASSIGNMENT = 'SYNTH_LAB_01';

// ---------- Short keys (append only: changing one breaks older codes) ----------
const PARAM_KEYS: Record<keyof SynthParams, string> = {
  masterVolume: 'mv',
  vco1Waveform: 'w1', vco1Octave: 'o1', vco1Semi: 's1', vco1Fine: 'f1', vco1Level: 'l1', vco1PulseWidth: 'p1',
  vco2Waveform: 'w2', vco2Octave: 'o2', vco2Semi: 's2', vco2Fine: 'f2', vco2Level: 'l2', vco2PulseWidth: 'p2',
  noiseLevel: 'nl', oscBalance: 'ob',
  filterCutoff: 'fc', filterResonance: 'fr', filterEnvAmount: 'fe', filterKeyTracking: 'fk', filterRolloff: 'fo',
  ampAttack: 'aa', ampDecay: 'ad', ampSustain: 'as', ampRelease: 'ar',
  modAttack: 'ma', modDecay: 'md', modSustain: 'ms', modRelease: 'mr',
  lfoRate: 'lr', lfoWaveform: 'lw', lfoDepth: 'ld', lfoDestination: 'lt',
  voiceMode: 'vm', glide: 'gl',
};
const PARAM_LONG = Object.fromEntries(Object.entries(PARAM_KEYS).map(([k, v]) => [v, k])) as Record<string, keyof SynthParams>;

const WAVE_CODES: Record<string, string> = { sine: 'i', triangle: 't', sawtooth: 'w', square: 'q', noise: 'n' };
const WAVE_LONG = Object.fromEntries(Object.entries(WAVE_CODES).map(([k, v]) => [v, k]));
const WAVE_FIELDS = new Set<keyof SynthParams>(['vco1Waveform', 'vco2Waveform', 'lfoWaveform']);

const sig4 = (n: number) => (Number.isFinite(n) ? Number(n.toPrecision(4)) : n);

// ---------- Patch pack / unpack ----------
export function packParams(params: SynthParams): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params) as [keyof SynthParams, unknown][]) {
    if (v === undefined || v === DEFAULT_SYNTH_PARAMS[k]) continue;
    const short = PARAM_KEYS[k] ?? k;
    if (typeof v === 'number') {
      const r = sig4(v);
      if (r === DEFAULT_SYNTH_PARAMS[k]) continue;
      out[short] = r;
    } else if (WAVE_FIELDS.has(k) && typeof v === 'string') {
      out[short] = WAVE_CODES[v] ?? v;
    } else {
      out[short] = v;
    }
  }
  return out;
}

/** Defaults before format version 2; older codes left these out when unchanged. */
const LEGACY_DEFAULTS: Partial<SynthParams> = { vco1PulseWidth: 0, vco2PulseWidth: 0, lfoDepth: 0.05 };

/** Old pulse width (Tone.js style, 0 = square) to duty cycle (0.5 = square). */
const legacyWidthToDuty = (w: unknown) => {
  const n = Number(w);
  return Number.isFinite(n) ? Math.max(0.05, Math.min(0.95, (1 + Math.max(-1, Math.min(1, n))) / 2)) : 0.5;
};

/** Bring settings saved before format version 2 up to date. */
export function upgradeLegacyParams(p: SynthParams): SynthParams {
  return { ...p, vco1PulseWidth: legacyWidthToDuty(p.vco1PulseWidth), vco2PulseWidth: legacyWidthToDuty(p.vco2PulseWidth) };
}

export function unpackParams(packed: Record<string, unknown>, legacy = false): SynthParams {
  const params: any = { ...DEFAULT_SYNTH_PARAMS, ...(legacy ? LEGACY_DEFAULTS : {}) };
  for (const [k, v] of Object.entries(packed || {})) {
    const long = (PARAM_LONG[k] ?? k) as keyof SynthParams;
    params[long] = WAVE_FIELDS.has(long) && typeof v === 'string' ? WAVE_LONG[v] ?? v : v;
  }
  return legacy ? upgradeLegacyParams(params) : (params as SynthParams);
}

/** Brief work packs as [patch, hints] or [patch, hints, note]. */
function packBriefs(briefs: Record<string, BriefWork>): Record<string, unknown[]> {
  return Object.fromEntries(
    Object.entries(briefs).map(([id, w]) => {
      const p = packParams(w.params);
      const note = (w.note || '').trim();
      return [id, note ? [p, w.hints, note] : [p, w.hints]];
    })
  );
}

function unpackBriefs(raw: unknown): Record<string, BriefWork> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Record<string, BriefWork> = {};
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(v)) continue;
    const [p, hints, note] = v;
    out[id] = {
      params: unpackParams((p as Record<string, unknown>) || {}),
      hints: Math.max(0, Math.min(2, Number(hints) || 0)),
      ...(typeof note === 'string' && note ? { note } : {}),
    };
  }
  return Object.keys(out).length ? out : undefined;
}

// ---------- Compression (deflate + URL-safe base64) ----------
function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

async function compress(text: string): Promise<string> {
  return toBase64Url(await pipe(new TextEncoder().encode(text), new CompressionStream('deflate-raw')));
}

async function decompress(code: string): Promise<string | null> {
  try {
    return new TextDecoder().decode(await pipe(fromBase64Url(code), new DecompressionStream('deflate-raw')));
  } catch {
    return null;
  }
}

/** Short checksum so a mistyped, cut-off or hand-edited code is caught. */
function checksum(text: string): string {
  let h = 0x811c9dc5;
  const str = text + 'SYNTH_SECURE_PEDAGOGY_SALT_2026';
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

// ---------- Submission codes ----------
export interface DecodedSubmission {
  submission: StudentSubmission;
  patchParams?: SynthParams;
}

export async function encodeSubmission(submission: StudentSubmission, params?: SynthParams): Promise<string> {
  const packed: Record<string, unknown> = {
    v: FORMAT_VERSION,
    n: submission.studentName.trim(),
    t: Math.floor(submission.timestamp / 1000),
    // score, or [score, tries] for Patch Master
    k: Object.fromEntries(
      submission.completedTasks.map((t) => [t.taskId, t.tries ? [Math.round(t.score), t.tries] : Math.round(t.score)])
    ),
  };
  if (submission.assignmentCode && submission.assignmentCode !== DEFAULT_ASSIGNMENT) packed.a = submission.assignmentCode;
  if (submission.assignedTasks?.length) packed.x = submission.assignedTasks.join(',');
  if (params) {
    const p = packParams(params);
    packed.p = Object.keys(p).length ? p : 0; // 0 = default patch
  }
  if (submission.briefs && Object.keys(submission.briefs).length) packed.b = packBriefs(submission.briefs);
  const json = JSON.stringify(packed);
  return `${await compress(json)}.${checksum(json)}`;
}

/** Returns the student's work, or null if the code is incomplete, mistyped or edited. */
export async function decodeSubmission(code: string): Promise<DecodedSubmission | null> {
  const raw = extractParam(code, 'report').replace(/\s+/g, '');
  const dot = raw.lastIndexOf('.');
  if (dot <= 0) return decodeLegacySubmission(raw);
  const json = await decompress(raw.slice(0, dot));
  if (!json || checksum(json) !== raw.slice(dot + 1)) return null;
  try {
    const d = JSON.parse(json);
    if (!d || typeof d.n !== 'string' || typeof d.k !== 'object') return null;
    const completedTasks = Object.entries(d.k as Record<string, number | [number, number]>).map(([taskId, v]) => {
      const [score, tries] = Array.isArray(v) ? v : [v, 0];
      return { taskId, taskTitle: taskTitle(taskId), score: Number(score) || 0, ...(tries ? { tries: Number(tries) } : {}) };
    });
    const assignedTasks = typeof d.x === 'string' ? cleanTaskList(d.x.split(',')) : [];
    return {
      submission: {
        studentName: d.n,
        assignmentCode: d.a || DEFAULT_ASSIGNMENT,
        assignedTasks,
        timestamp: (Number(d.t) || 0) * 1000,
        totalScore: headlineScore(gradesFor(completedTasks, assignedTasks)),
        completedTasks,
        encodedVerification: raw.slice(dot + 1),
        patchUrl: '',
        briefs: unpackBriefs(d.b),
      },
      patchParams: d.p === undefined ? undefined : unpackParams(d.p || {}, d.v !== FORMAT_VERSION),
    };
  } catch {
    return null;
  }
}

/** Codes made before October 2026: base64 JSON with a signature. */
function decodeLegacySubmission(raw: string): DecodedSubmission | null {
  try {
    let text = raw;
    try {
      text = decodeURIComponent(raw);
    } catch {
      /* already decoded */
    }
    const d = JSON.parse(atob(text));
    if (!d || !d.n || d.s === undefined || !d.sig) return null;
    const completedTasks = (Array.isArray(d.tasks) ? d.tasks : []).map((t: any) => ({
      taskId: String(t.taskId),
      taskTitle: t.taskTitle || taskTitle(String(t.taskId)),
      score: Number(t.score) || 0,
    }));
    const taskStr = completedTasks.map((t: any) => `${t.taskId}:${Math.round(t.score)}`).sort().join(',');
    const expected = legacyHash(`${d.n.trim().toUpperCase()}:${d.s}:${d.a || DEFAULT_ASSIGNMENT}:${taskStr}:${d.t}`);
    if (expected !== d.sig) return null;
    let patchParams: SynthParams | undefined;
    try {
      if (d.p) patchParams = upgradeLegacyParams({ ...DEFAULT_SYNTH_PARAMS, ...LEGACY_DEFAULTS, ...JSON.parse(d.p) });
    } catch {
      /* no patch */
    }
    return {
      submission: {
        studentName: d.n,
        assignmentCode: d.a || DEFAULT_ASSIGNMENT,
        timestamp: d.t || 0,
        totalScore: headlineScore(gradesFor(completedTasks)),
        completedTasks,
        encodedVerification: d.sig,
        patchUrl: '',
      },
      patchParams,
    };
  } catch {
    return null;
  }
}

function legacyHash(input: string): string {
  let hash = 0x811c9dc5;
  const str = input + 'SYNTH_SECURE_PEDAGOGY_SALT_2026';
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(16).toUpperCase().padStart(8, '0');
}

// ---------- Patch codes ----------
export async function encodePatch(params: SynthParams): Promise<string> {
  return compress(JSON.stringify({ ...packParams(params), v: FORMAT_VERSION }));
}

/** Accepts a new short patch code, an older base64 patch code, or a link containing ?patch=. */
export async function decodePatch(code: string): Promise<SynthParams | null> {
  const raw = extractParam(code, 'patch').replace(/\s+/g, '');
  if (!raw) return null;
  const json = await decompress(raw);
  if (json) {
    try {
      const parsed = JSON.parse(json);
      if (parsed && typeof parsed === 'object') {
        const { v, ...rest } = parsed;
        return unpackParams(rest, v !== FORMAT_VERSION);
      }
    } catch {
      /* fall through to older format */
    }
  }
  try {
    let text = raw;
    try {
      text = decodeURIComponent(raw);
    } catch {
      /* already decoded */
    }
    const parsed = JSON.parse(atob(text));
    if (parsed && typeof parsed === 'object') return upgradeLegacyParams({ ...DEFAULT_SYNTH_PARAMS, ...LEGACY_DEFAULTS, ...parsed });
  } catch {
    /* not a patch */
  }
  return null;
}

/** Pull `name=` out of a pasted link; otherwise return the text as-is. */
function extractParam(text: string, name: string): string {
  const t = text.trim();
  const match = t.match(new RegExp(`[?&]${name}=([^&#\\s]+)`));
  return match ? match[1] : t;
}
