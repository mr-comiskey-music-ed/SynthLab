import { SynthParams, StudentSubmission } from '../types';
import { DEFAULT_SYNTH_PARAMS } from './presets';
import { taskTitle, totalScoreFor } from './taskCatalog';

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
 */

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

export function unpackParams(packed: Record<string, unknown>): SynthParams {
  const params: any = { ...DEFAULT_SYNTH_PARAMS };
  for (const [k, v] of Object.entries(packed || {})) {
    const long = PARAM_LONG[k] ?? k;
    params[long] = WAVE_FIELDS.has(long) && typeof v === 'string' ? WAVE_LONG[v] ?? v : v;
  }
  return params as SynthParams;
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
    n: submission.studentName.trim(),
    t: Math.floor(submission.timestamp / 1000),
    k: Object.fromEntries(submission.completedTasks.map((t) => [t.taskId, Math.round(t.score)])),
  };
  if (submission.assignmentCode && submission.assignmentCode !== DEFAULT_ASSIGNMENT) packed.a = submission.assignmentCode;
  if (params) {
    const p = packParams(params);
    packed.p = Object.keys(p).length ? p : 0; // 0 = default patch
  }
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
    const completedTasks = Object.entries(d.k as Record<string, number>).map(([taskId, score]) => ({
      taskId,
      taskTitle: taskTitle(taskId),
      score: Number(score) || 0,
    }));
    return {
      submission: {
        studentName: d.n,
        assignmentCode: d.a || DEFAULT_ASSIGNMENT,
        timestamp: (Number(d.t) || 0) * 1000,
        totalScore: totalScoreFor(completedTasks),
        completedTasks,
        encodedVerification: raw.slice(dot + 1),
        patchUrl: '',
      },
      patchParams: d.p === undefined ? undefined : unpackParams(d.p || {}),
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
      if (d.p) patchParams = { ...DEFAULT_SYNTH_PARAMS, ...JSON.parse(d.p) };
    } catch {
      /* no patch */
    }
    return {
      submission: {
        studentName: d.n,
        assignmentCode: d.a || DEFAULT_ASSIGNMENT,
        timestamp: d.t || 0,
        totalScore: d.s,
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
  return compress(JSON.stringify(packParams(params)));
}

/** Accepts a new short patch code, an older base64 patch code, or a link containing ?patch=. */
export async function decodePatch(code: string): Promise<SynthParams | null> {
  const raw = extractParam(code, 'patch').replace(/\s+/g, '');
  if (!raw) return null;
  const json = await decompress(raw);
  if (json) {
    try {
      const parsed = JSON.parse(json);
      if (parsed && typeof parsed === 'object') return unpackParams(parsed);
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
    if (parsed && typeof parsed === 'object') return { ...DEFAULT_SYNTH_PARAMS, ...parsed };
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
