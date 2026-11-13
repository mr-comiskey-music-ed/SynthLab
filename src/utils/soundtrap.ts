import { SynthParams, PhraseId } from '../types';
import { DEFAULT_SYNTH_PARAMS } from './presets';
import { EngineExtras } from '../audio/synthEngine';
import { PhraseNote } from './playback';

/**
 * The Soundtrap synth (built like a Roland Juno-106), for the optional Soundtrap Synth Guide.
 * Its panel has its own settings; they are translated to the app's engine with toSynthParams + toExtras.
 *
 * Slider ranges are our best match to Soundtrap's; Soundtrap shows its own numbers, which may differ a little.
 */
export interface SoundtrapPatch {
  // LFO
  lfoSync: boolean;
  lfoWave: 'sine' | 'sawtooth' | 'triangle';
  lfoRate: number; // Hz (when Sync is off)
  lfoSyncDiv: number; // index into SYNC_DIVS (when Sync is on)
  lfoDelay: number; // ms
  // Oscillators
  oscLfo: number; // % pitch LFO (vibrato)
  pwm: number; // %
  pwmMode: 'lfo' | 'man';
  square: boolean;
  saw: boolean;
  sub: boolean;
  subLevel: number; // %
  noise: number; // %
  // HPF
  hpf: number; // Hz
  // Filter
  cutoff: number; // Hz
  res: number; // %
  envPolarity: 'reg' | 'inv';
  env: number; // %
  filterLfo: number; // %
  kybd: number; // %
  // Amp
  ampMode: 'env' | 'bypass';
  gain: number; // dB
  // Envelope
  attack: number; // ms
  decay: number; // ms
  sustain: number; // %
  release: number; // ms
  // Chorus
  chorus1: boolean;
  chorus2: boolean;
  // Glide
  mono: boolean;
  glide: number; // ms
}

/** Tempo-synced LFO rates, slowest to fastest. In Soundtrap they follow the song's tempo; here, 120 BPM. */
export const SYNC_DIVS: { label: string; beats: number }[] = [
  { label: '1/1', beats: 4 },
  { label: '1/2', beats: 2 },
  { label: '1/4.', beats: 1.5 },
  { label: '1/4', beats: 1 },
  { label: '1/8.', beats: 0.75 },
  { label: '1/4T', beats: 2 / 3 },
  { label: '1/8', beats: 0.5 },
  { label: '1/8T', beats: 1 / 3 },
  { label: '1/16', beats: 0.25 },
  { label: '1/16T', beats: 1 / 6 },
  { label: '1/32', beats: 0.125 },
];
export const GUIDE_BPM = 120;
const divHz = (i: number) => 1 / ((SYNC_DIVS[Math.max(0, Math.min(SYNC_DIVS.length - 1, Math.round(i)))].beats * 60) / GUIDE_BPM);

export type SliderKey =
  | 'lfoRate'
  | 'lfoDelay'
  | 'oscLfo'
  | 'pwm'
  | 'subLevel'
  | 'noise'
  | 'hpf'
  | 'cutoff'
  | 'res'
  | 'env'
  | 'filterLfo'
  | 'kybd'
  | 'gain'
  | 'attack'
  | 'decay'
  | 'sustain'
  | 'release'
  | 'glide';

export interface SliderSpec {
  label: string;
  min: number;
  max: number;
  unit: 'Hz' | '%' | 'ms' | 'dB';
  /** How the slider's travel maps to values: even, log (pitch-like) or curved (fine control at the bottom). */
  curve: 'linear' | 'log' | 'curved';
  step?: number;
}

export const SLIDERS: Record<SliderKey, SliderSpec> = {
  lfoRate: { label: 'Rate', min: 0.1, max: 20, unit: 'Hz', curve: 'log' },
  lfoDelay: { label: 'Delay Time', min: 0, max: 3000, unit: 'ms', curve: 'curved' },
  oscLfo: { label: 'LFO', min: 0, max: 100, unit: '%', curve: 'linear' },
  pwm: { label: 'PWM', min: 0, max: 100, unit: '%', curve: 'linear' },
  subLevel: { label: 'Sub-Osc', min: 0, max: 100, unit: '%', curve: 'linear' },
  noise: { label: 'Noise', min: 0, max: 100, unit: '%', curve: 'linear' },
  hpf: { label: 'Freq', min: 20, max: 4000, unit: 'Hz', curve: 'log' },
  cutoff: { label: 'Freq', min: 20, max: 20000, unit: 'Hz', curve: 'log' },
  res: { label: 'Res', min: 0, max: 100, unit: '%', curve: 'linear' },
  env: { label: 'Env', min: 0, max: 100, unit: '%', curve: 'linear' },
  filterLfo: { label: 'LFO', min: 0, max: 100, unit: '%', curve: 'linear' },
  kybd: { label: 'Kybd', min: 0, max: 100, unit: '%', curve: 'linear' },
  gain: { label: 'Gain', min: -24, max: 6, unit: 'dB', curve: 'linear', step: 0.5 },
  attack: { label: 'A', min: 1, max: 3000, unit: 'ms', curve: 'curved' },
  decay: { label: 'D', min: 1, max: 10000, unit: 'ms', curve: 'curved' },
  sustain: { label: 'S', min: 0, max: 100, unit: '%', curve: 'linear' },
  release: { label: 'R', min: 1, max: 10000, unit: 'ms', curve: 'curved' },
  glide: { label: 'Glide', min: 0, max: 1000, unit: 'ms', curve: 'curved' },
};

/** Slider travel (0-1) for a value. */
export function sliderPos(spec: SliderSpec, v: number): number {
  const c = Math.max(spec.min, Math.min(spec.max, v));
  if (spec.curve === 'log') return Math.log(c / spec.min) / Math.log(spec.max / spec.min);
  const t = (c - spec.min) / (spec.max - spec.min);
  return spec.curve === 'curved' ? Math.cbrt(t) : t;
}

/** Value for a slider travel (0-1), rounded to something readable. */
export function sliderValue(spec: SliderSpec, pos: number): number {
  const t = Math.max(0, Math.min(1, pos));
  let v: number;
  if (spec.curve === 'log') v = spec.min * Math.pow(spec.max / spec.min, t);
  else if (spec.curve === 'curved') v = spec.min + (spec.max - spec.min) * t * t * t;
  else v = spec.min + (spec.max - spec.min) * t;
  if (spec.step) return Math.round(v / spec.step) * spec.step;
  if (spec.unit === 'Hz') return v < 10 ? Math.round(v * 10) / 10 : v < 1000 ? Math.round(v) : Math.round(v / 10) * 10;
  if (spec.unit === 'ms') return v < 100 ? Math.max(spec.min, Math.round(v)) : Math.round(v / 5) * 5;
  return Math.round(v);
}

export function formatValue(spec: SliderSpec, v: number): string {
  switch (spec.unit) {
    case 'Hz':
      return v < 10 ? `${v.toFixed(1)} Hz` : v < 1000 ? `${Math.round(v)} Hz` : `${(v / 1000).toFixed(v < 10000 ? 2 : 1)} kHz`;
    case 'ms':
      return `${Math.round(v).toLocaleString()} ms`;
    case 'dB':
      return `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`;
    default:
      return `${Math.round(v)}%`;
  }
}

/** A plain starting point for the guide: Saw only (like Soundtrap), filter open, nothing moving. */
export const GUIDE_BASE: SoundtrapPatch = {
  lfoSync: false,
  lfoWave: 'sine',
  lfoRate: 5,
  lfoSyncDiv: 6,
  lfoDelay: 0,
  oscLfo: 0,
  pwm: 0,
  pwmMode: 'man',
  // Soundtrap starts on Saw only.
  square: false,
  saw: true,
  sub: false,
  subLevel: 0,
  noise: 0,
  hpf: 20,
  cutoff: 8000,
  res: 0,
  envPolarity: 'reg',
  env: 0,
  filterLfo: 0,
  kybd: 0,
  ampMode: 'env',
  gain: 0,
  attack: 5,
  decay: 400,
  sustain: 80,
  release: 300,
  chorus1: false,
  chorus2: false,
  mono: false,
  glide: 0,
};

const OSC_LEVEL = 0.6;

/** The Soundtrap panel's settings as the app engine's settings. */
export function toSynthParams(st: SoundtrapPatch): SynthParams {
  const sec = (ms: number) => Math.max(0.001, ms / 1000);
  const env = { attack: sec(st.attack), decay: sec(st.decay), sustain: st.sustain / 100, release: sec(st.release) };
  // BYPASS: the volume is simply on while a key is held (the Juno's GATE). The envelope still moves the filter.
  const amp = st.ampMode === 'env' ? env : { attack: 0.003, decay: 0.01, sustain: 1, release: 0.02 };
  return {
    ...DEFAULT_SYNTH_PARAMS,
    masterVolume: Math.min(1.5, 0.75 * Math.pow(10, st.gain / 20)),
    vco1Waveform: 'square',
    vco1Level: st.square ? OSC_LEVEL : 0,
    vco1PulseWidth: st.pwmMode === 'man' ? 0.5 - 0.45 * (st.pwm / 100) : 0.5,
    vco1Octave: 0,
    vco1Semi: 0,
    vco1Fine: 0,
    vco2Waveform: 'sawtooth',
    vco2Level: st.saw ? OSC_LEVEL : 0,
    vco2Octave: 0,
    vco2Semi: 0,
    vco2Fine: 0,
    noiseLevel: (st.noise / 100) * OSC_LEVEL,
    oscBalance: 0,
    filterCutoff: st.cutoff,
    filterResonance: 0.7 + Math.pow(st.res / 100, 1.6) * 17,
    filterEnvAmount: (st.envPolarity === 'inv' ? -1 : 1) * st.env,
    filterKeyTracking: st.kybd / 100,
    filterRolloff: -24,
    ampAttack: amp.attack,
    ampDecay: amp.decay,
    ampSustain: amp.sustain,
    ampRelease: amp.release,
    modAttack: env.attack,
    modDecay: env.decay,
    modSustain: env.sustain,
    modRelease: env.release,
    lfoRate: st.lfoSync ? divHz(st.lfoSyncDiv) : st.lfoRate,
    lfoWaveform: st.lfoWave,
    // The guide routes the LFO with separate amounts (toExtras); these are only for anything that reads one value.
    lfoDepth: Math.max(st.oscLfo, st.filterLfo) / 100,
    lfoDestination: st.oscLfo >= st.filterLfo ? 'pitch' : 'cutoff',
    voiceMode: st.mono ? 'mono' : 'poly',
    glide: st.mono ? st.glide / 1000 : 0,
  };
}

/** The Soundtrap hardware the app's own synths don't have. */
export function toExtras(st: SoundtrapPatch): EngineExtras {
  return {
    lfoAmounts: {
      pitch: st.oscLfo / 100,
      cutoff: st.filterLfo / 100,
      pwm: st.square && st.pwmMode === 'lfo' ? st.pwm / 100 : 0,
    },
    lfoDelay: st.lfoDelay / 1000,
    hpfCutoff: st.hpf <= 20 ? 0 : st.hpf,
    subLevel: st.sub ? (st.subLevel / 100) * OSC_LEVEL : 0,
    chorus: ((st.chorus1 ? 1 : 0) + (st.chorus2 ? 2 : 0)) as EngineExtras['chorus'],
  };
}

// ---------- The guide ----------

/** Panel sections, used to glow the part of the Soundtrap synth a step is about. */
export type StSection = 'lfo' | 'osc' | 'hpf' | 'filter' | 'amp' | 'env' | 'chorus' | 'glide';
/** Parts of the Soundtrap signal-path diagram. */
export type StFlow = 'osc' | 'hpf' | 'filter' | 'amp' | 'chorus' | 'env' | 'lfo';

export interface StMission {
  text: string;
  check: (p: SoundtrapPatch) => boolean;
}

export interface StStep {
  title: string;
  short: string;
  sections: StSection[];
  flow: StFlow[];
  what: string;
  listen: string;
  start: Partial<SoundtrapPatch>;
  phrase: PhraseNote[];
  missions: StMission[];
  extra?: 'names';
}

const one = (note: string, dur: number, at = 0): PhraseNote => ({ note, at, dur });
const run = (notes: string[], step: number, dur: number): PhraseNote[] => notes.map((n, i) => one(n, dur, i * step));

/** SynthLab name → Soundtrap name, for step 1. */
export const NAME_MAP: { synthlab: string; soundtrap: string; note?: string }[] = [
  { synthlab: 'VCO 1 + VCO 2, Waveform', soundtrap: 'OSCILLATORS: wave buttons', note: 'one oscillator, waves switched on together' },
  { synthlab: 'Noise', soundtrap: 'OSCILLATORS: Noise' },
  { synthlab: 'Pulse Width', soundtrap: 'OSCILLATORS: PWM', note: 'with an LFO / MAN switch' },
  { synthlab: 'Cutoff', soundtrap: 'FILTER: Freq' },
  { synthlab: 'Resonance', soundtrap: 'FILTER: Res' },
  { synthlab: 'EG Amount', soundtrap: 'FILTER: Env', note: 'with a REG / INV switch' },
  { synthlab: 'Amp EG + Filter EG', soundtrap: 'ENVELOPE: A D S R', note: 'one envelope for both' },
  { synthlab: 'LFO Rate, Waveform', soundtrap: 'LFO: Rate, SIN / SAW / TRI' },
  { synthlab: 'LFO Depth + Target', soundtrap: 'an LFO slider in each section it moves' },
  { synthlab: 'Master volume', soundtrap: 'AMP: Gain' },
  { synthlab: 'Mono + Glide', soundtrap: 'GLIDE: Monophonic + Glide' },
  { synthlab: '(new)', soundtrap: 'HPF, Kybd, LFO Delay Time, Chorus' },
];

export const ST_STEPS: StStep[] = [
  {
    title: 'Same sound path, new names',
    short: 'New names',
    sections: ['osc', 'filter', 'amp', 'env', 'lfo'],
    flow: ['osc', 'filter', 'amp', 'env', 'lfo'],
    what:
      'Soundtrap’s synth is built like a famous 1980s synth, the Roland Juno-106. The sound travels the same path you learned in SynthLab: an oscillator makes the raw tone, a filter carves it, the amp shapes its volume, and an envelope and an LFO move things for you. Most of the names are different, and every control is a slider instead of a knob. Slide up for more.',
    listen: 'It should sound familiar: same building blocks, new panel.',
    start: {},
    phrase: run(['C3', 'E3', 'G3', 'C4'], 0.5, 0.45),
    missions: [
      { text: 'Find your Cutoff. In the FILTER section, pull Freq down below 1,000 Hz and listen.', check: (p) => p.cutoff < 1000 },
      { text: 'Find your Release. In the ENVELOPE section, raise R to 1,000 ms or more and listen to the notes ring.', check: (p) => p.release >= 1000 },
    ],
    extra: 'names',
  },
  {
    title: 'One oscillator, three waves to mix',
    short: 'Oscillator',
    sections: ['osc'],
    flow: ['osc'],
    what:
      'SynthLab has two VCOs, each with a Waveform knob. Soundtrap has one oscillator with three buttons that you can turn on together: Square, Saw and Sub-Osc. The Sub-Osc is a square wave one octave lower, which adds weight underneath. Turning it on wakes up the Sub-Osc slider, which sets how loud it is. Noise has its own slider, just like in SynthLab.',
    listen: 'Square is hollow, Saw is bright and buzzy, and both together are thicker. The Sub-Osc adds a low, heavy layer.',
    start: { square: false, saw: true, cutoff: 6000 },
    phrase: run(['A2', 'C3', 'E3', 'A3'], 0.5, 0.45),
    missions: [
      { text: 'Soundtrap starts on Saw only. Turn on Square too, so Saw and Square are both lit.', check: (p) => p.square && p.saw },
      { text: 'Now turn Saw off, so only Square is on.', check: (p) => p.square && !p.saw },
      { text: 'Turn on the Sub-Osc button, then raise the Sub-Osc slider to 50% or more.', check: (p) => p.sub && p.subLevel >= 50 },
    ],
  },
  {
    title: 'Pulse width: PWM and the LFO / MAN switch',
    short: 'PWM',
    sections: ['osc', 'lfo'],
    flow: ['osc', 'lfo'],
    what:
      'PWM is Soundtrap’s Pulse Width control, and it only changes the Square wave. The switch next to it decides what moves it. On MAN (manual), the slider sets the width, like the Pulse Width knob in SynthLab: the higher it goes, the thinner and more nasal the sound. On LFO, the slider sets how far the LFO sweeps the width back and forth, which gives a moving, shimmering sound.',
    listen: 'MAN: thinner and reedier as you raise it. LFO: a slow shimmer that never sits still.',
    start: { square: true, saw: false, pwm: 0, pwmMode: 'man', cutoff: 6000, lfoRate: 1.5, lfoWave: 'triangle' },
    phrase: [one('D3', 1.4), one('A3', 1.4, 1.5)],
    missions: [
      { text: 'With the switch on MAN, raise PWM to 60% or more.', check: (p) => p.square && p.pwmMode === 'man' && p.pwm >= 60 },
      { text: 'Flip the switch up to LFO, keep PWM at 50% or more, and hold a note to hear the shimmer.', check: (p) => p.square && p.pwmMode === 'lfo' && p.pwm >= 50 },
    ],
  },
  {
    title: 'Two filters: HPF and Filter',
    short: 'Filters',
    sections: ['hpf', 'filter'],
    flow: ['hpf', 'filter'],
    what:
      'The FILTER section is the low-pass filter you know: Freq is your Cutoff and Res is your Resonance. Kybd (keyboard tracking) is new: it makes the cutoff follow the keys, so high notes come out brighter and low notes darker, like a real instrument. To its left is a second filter that SynthLab doesn’t have, the HPF (high-pass filter). It does the opposite job: it cuts the lows below its Freq and makes the sound thinner. Use it to keep a pad or lead from sounding muddy.',
    listen: 'Low-pass: bright to dark, with a ringing peak from Res. High-pass: the bottom of the sound disappearing.',
    start: { square: false, saw: true, cutoff: 3000 },
    phrase: [one('C2', 0.8), one('C3', 0.8, 0.9), one('C4', 0.8, 1.8), one('C5', 0.8, 2.7)],
    missions: [
      { text: 'Set the Filter Freq between 800 and 1,500 Hz and Res to 40% or more.', check: (p) => p.cutoff >= 800 && p.cutoff <= 1500 && p.res >= 40 },
      { text: 'Now raise the HPF Freq to 300 Hz or more and hear the low end thin out.', check: (p) => p.hpf >= 300 },
      {
        text: 'Pull the HPF back down below 100 Hz, then raise Kybd to 70% or more. Listen to low and high notes: the high ones should be brighter.',
        check: (p) => p.hpf < 100 && p.kybd >= 70,
      },
    ],
  },
  {
    title: 'One envelope does two jobs',
    short: 'Envelope',
    sections: ['env', 'filter', 'amp'],
    flow: ['env', 'filter', 'amp'],
    what:
      'This is the biggest difference. SynthLab has two envelopes: the Amp EG for volume and the Filter EG for the cutoff. Soundtrap has one ENVELOPE (A, D, S, R) that can do both jobs at once. The Filter Env slider sets how far it moves the cutoff, like EG Amount. REG moves the cutoff up; INV flips it, so the cutoff dips down instead. In the AMP section, ENV means the same envelope also shapes the volume. BYPASS ignores the envelope for volume, so the sound simply stays on while you hold a key, while the envelope keeps moving the filter.',
    listen: 'REG: each note starts bright and closes down (a pluck). BYPASS: the volume holds, but the brightness still plucks. INV: each note starts dark and swells open.',
    start: { square: false, saw: true, cutoff: 400, res: 20, env: 0, attack: 1, decay: 900, sustain: 0, release: 300, ampMode: 'env' },
    phrase: run(['D2', 'F2', 'A2', 'D3'], 0.6, 0.5),
    missions: [
      {
        text: 'Make a pluck: raise the Filter Env slider to 100%, then in ENVELOPE set D between 300 and 600 ms. Keep Filter Freq below 800 Hz.',
        check: (p) => p.env >= 95 && p.decay >= 300 && p.decay <= 600 && p.cutoff < 800 && p.envPolarity === 'reg' && p.ampMode === 'env',
      },
      { text: 'Flip the AMP switch to BYPASS: the volume holds while the filter still plucks.', check: (p) => p.ampMode === 'bypass' && p.env >= 95 },
      {
        text: 'Flip the Env switch to INV: now each note starts dark and swells open.',
        check: (p) => p.envPolarity === 'inv' && p.env >= 95 && p.cutoff < 800,
      },
    ],
  },
  {
    title: 'The LFO: one wave, three places to send it',
    short: 'LFO',
    sections: ['lfo', 'osc', 'filter'],
    flow: ['lfo', 'osc', 'filter'],
    what:
      'In SynthLab the LFO has one Depth knob and a Target switch. Soundtrap’s LFO section only sets the wave (SIN, SAW, TRI), the Rate and a Delay Time. How much it moves each thing is set in the section it moves: the LFO slider in OSCILLATORS is vibrato (pitch), the LFO slider in FILTER is wobble (cutoff), and PWM on LFO is shimmer. They can all be up at once. Delay Time makes the LFO wait and fade in, so a long note starts steady and then wobbles, like a singer’s vibrato. SYNC locks the Rate to the song’s tempo, so the slider steps through note values (1/4, 1/8, 1/16T…) instead of Hz.',
    listen: 'Vibrato: the pitch wavering. Delay: a steady start, then vibrato. Synced wobble: the tone pulsing in time.',
    start: { square: false, saw: true, cutoff: 1500, res: 30, sustain: 100, decay: 400, release: 400, lfoWave: 'sine', lfoRate: 2, lfoDelay: 0 },
    phrase: [one('A3', 2.6)],
    missions: [
      {
        text: 'Vibrato: raise the LFO slider in OSCILLATORS to 15% or more, with the LFO Rate between 4 and 8 Hz (Sync off).',
        check: (p) => p.oscLfo >= 15 && !p.lfoSync && p.lfoRate >= 4 && p.lfoRate <= 8,
      },
      { text: 'Delayed vibrato: raise Delay Time to 500 ms or more, then hold a long note.', check: (p) => p.oscLfo >= 15 && p.lfoDelay >= 500 },
      {
        text: 'Wobble in time: turn on SYNC, set the Rate to 1/8, and raise the LFO slider in FILTER to 40% or more.',
        check: (p) => p.lfoSync && SYNC_DIVS[p.lfoSyncDiv]?.label === '1/8' && p.filterLfo >= 40,
      },
    ],
  },
  {
    title: 'Chorus and Glide',
    short: 'Chorus + Glide',
    sections: ['chorus', 'glide'],
    flow: ['chorus'],
    what:
      'Two extras at the end of the panel. CHORUS copies the sound, detunes the copy a little and keeps it moving, so it sounds wide and lush, like the two detuned VCOs you tried in Learn. I is gentle, II is deeper, and both together is faster. GLIDE works like SynthLab’s Mono with Glide: press Monophonic On/Off so only one note plays at a time, and the Glide slider wakes up and sets how long the pitch slides from note to note.',
    listen: 'Chorus: wider and shimmering. Glide: notes sliding into each other.',
    start: { square: false, saw: true, cutoff: 3000, attack: 30, decay: 800, sustain: 70, release: 600 },
    phrase: run(['C3', 'G3', 'E3', 'C4', 'G3'], 0.4, 0.38),
    missions: [
      { text: 'Turn on Chorus II.', check: (p) => p.chorus2 },
      { text: 'Turn on Monophonic, raise Glide to 200 ms or more, and play a few notes in a row.', check: (p) => p.mono && p.glide >= 200 },
    ],
  },
];

// ---------- Settings to try ----------

export interface StartingPoint {
  name: string;
  what: string;
  phrase: PhraseId;
  patch: Partial<SoundtrapPatch>;
}

export const STARTING_POINTS: StartingPoint[] = [
  {
    name: 'Round Bass',
    what: 'Saw plus Sub-Osc through a low filter, with a quick envelope plucking the cutoff.',
    phrase: 'bassRiff',
    patch: { square: false, saw: true, sub: true, subLevel: 70, cutoff: 500, res: 25, env: 45, kybd: 50, attack: 1, decay: 350, sustain: 20, release: 120 },
  },
  {
    name: 'Warm Strings Pad',
    what: 'Square and Saw, with the LFO sweeping the pulse width, slow envelope and Chorus I.',
    phrase: 'padChords',
    patch: {
      square: true, saw: true, pwm: 45, pwmMode: 'lfo', lfoWave: 'triangle', lfoRate: 0.6, hpf: 150, cutoff: 2800, res: 10, env: 15,
      attack: 700, decay: 1500, sustain: 80, release: 1500, chorus1: true,
    },
  },
  {
    name: 'Brass Stab',
    what: 'Saw with a strong filter envelope: each note opens up bright, then settles.',
    phrase: 'leadLine',
    patch: { square: false, saw: true, cutoff: 900, res: 15, env: 60, kybd: 60, attack: 60, decay: 450, sustain: 55, release: 250, chorus1: true },
  },
  {
    name: 'Plucky Keys',
    what: 'A thin pulse wave with a short pluck envelope and Chorus II.',
    phrase: 'pluckArp',
    patch: { square: true, saw: false, pwm: 40, pwmMode: 'man', cutoff: 1200, res: 20, env: 55, attack: 1, decay: 280, sustain: 0, release: 300, chorus2: true },
  },
  {
    name: 'Gliding Lead',
    what: 'Saw plus a little Sub-Osc, Monophonic with Glide, and vibrato that fades in.',
    phrase: 'leadLine',
    patch: {
      square: false, saw: true, sub: true, subLevel: 40, cutoff: 3000, res: 30, env: 25, attack: 10, decay: 600, sustain: 80, release: 250,
      oscLfo: 12, lfoRate: 5.5, lfoDelay: 600, chorus1: true, mono: true, glide: 120,
    },
  },
];

/** Every control of a patch, section by section, written the way the Soundtrap panel shows it. */
export function describePatch(p: SoundtrapPatch): { section: string; items: string[] }[] {
  const f = (k: SliderKey) => `${SLIDERS[k].label} ${formatValue(SLIDERS[k], p[k])}`;
  const onOff = (b: boolean) => (b ? 'on' : 'off');
  return [
    {
      section: 'LFO',
      items: [
        p.lfoWave === 'sine' ? 'SIN' : p.lfoWave === 'sawtooth' ? 'SAW' : 'TRI',
        p.lfoSync ? `Sync on, Rate ${SYNC_DIVS[p.lfoSyncDiv]?.label}` : `Sync off, ${f('lfoRate')}`,
        f('lfoDelay'),
      ],
    },
    {
      section: 'Oscillators',
      items: [
        `Square ${onOff(p.square)}`,
        `Saw ${onOff(p.saw)}`,
        p.sub ? `Sub-Osc on, ${formatValue(SLIDERS.subLevel, p.subLevel)}` : 'Sub-Osc off',
        `PWM ${formatValue(SLIDERS.pwm, p.pwm)} (${p.pwmMode === 'lfo' ? 'LFO' : 'MAN'})`,
        f('oscLfo'),
        f('noise'),
      ],
    },
    { section: 'HPF', items: [p.hpf <= 20 ? 'Freq all the way down' : f('hpf')] },
    {
      section: 'Filter',
      items: [f('cutoff'), f('res'), `Env ${formatValue(SLIDERS.env, p.env)} (${p.envPolarity === 'inv' ? 'INV' : 'REG'})`, f('filterLfo'), f('kybd')],
    },
    { section: 'Amp', items: [p.ampMode === 'env' ? 'ENV' : 'BYPASS', f('gain')] },
    { section: 'Envelope', items: [f('attack'), f('decay'), f('sustain'), f('release')] },
    { section: 'Chorus', items: [p.chorus1 && p.chorus2 ? 'I and II' : p.chorus1 ? 'I' : p.chorus2 ? 'II' : 'off'] },
    { section: 'Glide', items: [p.mono ? `Monophonic on, ${f('glide')}` : 'Monophonic off'] },
  ];
}

// ---------- Progress (kept like Learn's: this visit, autosave and the submission code) ----------

export const soundtrapProgress = {
  step: 0,
  started: false,
  done: ST_STEPS.map(() => 0),
  finished: false,
};

export function soundtrapSummary(): { done: number; total: number } {
  return {
    done: ST_STEPS.filter((s, i) => (soundtrapProgress.done[i] ?? 0) >= s.missions.length).length,
    total: ST_STEPS.length,
  };
}

/** From a code: the first `steps` steps are finished. Never takes progress away. */
export function restoreSoundtrapSteps(steps: number): void {
  const n = Math.max(0, Math.min(ST_STEPS.length, Math.round(steps)));
  if (!n) return;
  ST_STEPS.forEach((s, i) => {
    if (i < n) soundtrapProgress.done[i] = Math.max(soundtrapProgress.done[i] ?? 0, s.missions.length);
  });
  soundtrapProgress.step = Math.max(soundtrapProgress.step, Math.min(n, ST_STEPS.length - 1));
}

export function soundtrapDoneSnapshot(): number[] {
  return [...soundtrapProgress.done];
}

/** From autosave: exact mission counts per step. Never takes progress away. */
export function restoreSoundtrapDone(done: number[] | undefined): void {
  if (!Array.isArray(done)) return;
  let any = false;
  ST_STEPS.forEach((s, i) => {
    const n = Math.max(0, Math.min(s.missions.length, Math.round(Number(done[i]) || 0)));
    if (n > 0) {
      soundtrapProgress.done[i] = Math.max(soundtrapProgress.done[i] ?? 0, n);
      any = true;
    }
  });
  if (!any) return;
  const firstOpen = ST_STEPS.findIndex((s, i) => (soundtrapProgress.done[i] ?? 0) < s.missions.length);
  soundtrapProgress.step = Math.max(soundtrapProgress.step, firstOpen === -1 ? ST_STEPS.length - 1 : firstOpen);
}
