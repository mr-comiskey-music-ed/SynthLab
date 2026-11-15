import { SynthParams } from '../types';
import { DEFAULT_SYNTH_PARAMS } from './presets';
import { EngineExtras, LfoShape } from '../audio/synthEngine';
import { SYNC_DIVS, divHz, GuideStep, GuideStartingPoint, NameRow, one, run, makeGuideProgress } from './guides';

/**
 * Logic Pro's Retro Synth (ANALOG engine), for the optional Retro Synth Guide.
 * Its panel has its own settings, shown in Logic's own units (Cutoff, Res and Sustain as 0-1 numbers),
 * translated to the app's engine with toSynthParams + toExtras.
 */
export interface RetroPatch {
  // Oscillator
  shape1: number; // 0-1: Noise → Saw → Square → thinner Pulse
  shape2: number; // 0-1: Triangle → Saw → Square → thinner Pulse
  shapeMod: number; // -1 (toward LFO) … 0 (off) … 1 (toward Filter Env)
  vibrato: number; // 0-1
  semitones: number; // Osc 2, -24 to 24
  cents: number; // Osc 2, -50 to 50
  mix: number; // 0 = all Osc 1, 1 = all Osc 2
  // Filter
  filterOn: boolean;
  filterType: 'lp24' | 'lp12' | 'hp';
  cutoff: number; // 0-1
  res: number; // 0-1
  key: number; // 0-1 keyboard tracking
  filterLfo: number; // 0-1
  filterEnv: number; // -1 to 1
  // Amp
  volume: number; // dB
  sineLevel: number; // 0-1
  // Effect
  fxOn: boolean;
  fxType: 'flanger' | 'chorus';
  fxMix: number; // 0-1
  fxRate: number; // Hz
  // Glide
  glideOn: boolean;
  glideTime: number; // ms
  // LFO (cutoff, shape) and Vibrato (pitch): two separate LFOs
  lfoWave: LfoShape;
  lfoRate: number; // Hz
  lfoSync: boolean;
  lfoSyncDiv: number;
  lfoAmount: number; // 0-1, the slider beside the screen
  vibWave: LfoShape;
  vibRate: number;
  vibSync: boolean;
  vibSyncDiv: number;
  vibAmount: number;
  // Filter Env
  fA: number; // ms
  fD: number; // ms
  fS: number; // 0-1
  fR: number; // ms
  fVel: number; // 0-1 (velocity: shown, not used here)
  // Amp Env
  aA: number;
  aD: number;
  aS: number;
  aR: number;
  aVel: number;
}

// ---------- Controls: ranges and how each reads ----------

export type RetroKey = {
  [K in keyof RetroPatch]: RetroPatch[K] extends number ? K : never;
}[keyof RetroPatch];

export interface RetroSpec {
  label: string;
  min: number;
  max: number;
  /** How travel maps to values: even, log (pitch-like) or curved (fine control at the bottom). */
  curve: 'linear' | 'log' | 'curved';
  /** How it reads and rounds. */
  kind: 'unit' | 'bipolar' | 'ms' | 'Hz' | 'dB' | 'semi' | 'cents' | 'shape1' | 'shape2' | 'mix' | 'shapeMod';
}

const ENV_MS = { min: 0.4, max: 10000, curve: 'curved' as const, kind: 'ms' as const };

export const RSPECS: Record<RetroKey, RetroSpec> = {
  shape1: { label: 'Shape 1', min: 0, max: 1, curve: 'linear', kind: 'shape1' },
  shape2: { label: 'Shape 2', min: 0, max: 1, curve: 'linear', kind: 'shape2' },
  shapeMod: { label: 'Shape Modulation', min: -1, max: 1, curve: 'linear', kind: 'shapeMod' },
  vibrato: { label: 'Vibrato', min: 0, max: 1, curve: 'linear', kind: 'unit' },
  semitones: { label: 'Semitones', min: -24, max: 24, curve: 'linear', kind: 'semi' },
  cents: { label: 'Cents', min: -50, max: 50, curve: 'linear', kind: 'cents' },
  mix: { label: 'Mix', min: 0, max: 1, curve: 'linear', kind: 'mix' },
  cutoff: { label: 'Cutoff', min: 0, max: 1, curve: 'linear', kind: 'unit' },
  res: { label: 'Res', min: 0, max: 1, curve: 'linear', kind: 'unit' },
  key: { label: 'Key', min: 0, max: 1, curve: 'linear', kind: 'unit' },
  filterLfo: { label: 'LFO', min: 0, max: 1, curve: 'linear', kind: 'unit' },
  filterEnv: { label: 'Env', min: -1, max: 1, curve: 'linear', kind: 'bipolar' },
  volume: { label: 'Volume', min: -30, max: 6, curve: 'linear', kind: 'dB' },
  sineLevel: { label: 'Sine Level', min: 0, max: 1, curve: 'linear', kind: 'unit' },
  fxMix: { label: 'Mix', min: 0, max: 1, curve: 'linear', kind: 'unit' },
  fxRate: { label: 'Rate', min: 0.05, max: 10, curve: 'log', kind: 'Hz' },
  glideTime: { label: 'Time', min: 0, max: 2000, curve: 'curved', kind: 'ms' },
  lfoRate: { label: 'Rate', min: 0.1, max: 30, curve: 'log', kind: 'Hz' },
  lfoSyncDiv: { label: 'Rate', min: 0, max: SYNC_DIVS.length - 1, curve: 'linear', kind: 'unit' },
  lfoAmount: { label: 'LFO amount', min: 0, max: 1, curve: 'linear', kind: 'unit' },
  vibRate: { label: 'Rate', min: 0.1, max: 30, curve: 'log', kind: 'Hz' },
  vibSyncDiv: { label: 'Rate', min: 0, max: SYNC_DIVS.length - 1, curve: 'linear', kind: 'unit' },
  vibAmount: { label: 'Vibrato amount', min: 0, max: 1, curve: 'linear', kind: 'unit' },
  fA: { label: 'A', ...ENV_MS },
  fD: { label: 'D', ...ENV_MS },
  fS: { label: 'S', min: 0, max: 1, curve: 'linear', kind: 'unit' },
  fR: { label: 'R', ...ENV_MS },
  fVel: { label: 'Vel', min: 0, max: 1, curve: 'linear', kind: 'unit' },
  aA: { label: 'A', ...ENV_MS },
  aD: { label: 'D', ...ENV_MS },
  aS: { label: 'S', min: 0, max: 1, curve: 'linear', kind: 'unit' },
  aR: { label: 'R', ...ENV_MS },
  aVel: { label: 'Vel', min: 0, max: 1, curve: 'linear', kind: 'unit' },
};

/** Control travel (0-1) for a value. */
export function rPos(spec: RetroSpec, v: number): number {
  const c = Math.max(spec.min, Math.min(spec.max, v));
  if (spec.curve === 'log') return Math.log(c / spec.min) / Math.log(spec.max / spec.min);
  const t = (c - spec.min) / (spec.max - spec.min);
  return spec.curve === 'curved' ? Math.cbrt(t) : t;
}

/** Value for a control travel (0-1), rounded the way Logic shows it. */
export function rValue(spec: RetroSpec, pos: number): number {
  const t = Math.max(0, Math.min(1, pos));
  let v: number;
  if (spec.curve === 'log') v = spec.min * Math.pow(spec.max / spec.min, t);
  else if (spec.curve === 'curved') v = spec.min + (spec.max - spec.min) * t * t * t;
  else v = spec.min + (spec.max - spec.min) * t;
  switch (spec.kind) {
    case 'semi':
    case 'cents':
      return Math.round(v);
    case 'dB':
      return Math.round(v * 2) / 2;
    case 'Hz':
      return v < 10 ? Math.round(v * 100) / 100 : Math.round(v * 10) / 10;
    case 'ms':
      return v < 10 ? Math.max(spec.min, Math.round(v * 10) / 10) : v < 100 ? Math.round(v) : Math.round(v / 5) * 5;
    default:
      return Math.round(v * 100) / 100;
  }
}

/** Where a Shape knob sits: the wave, and the pulse's duty cycle in the pulse zone. */
export function shapeAt(v: number, which: 1 | 2): { wave: 'noise' | 'triangle' | 'sawtooth' | 'square'; duty: number; name: string } {
  if (v < 0.2) return which === 1 ? { wave: 'noise', duty: 0.5, name: 'Noise' } : { wave: 'triangle', duty: 0.5, name: 'Triangle' };
  if (v < 0.4) return { wave: 'sawtooth', duty: 0.5, name: 'Saw' };
  if (v < 0.55) return { wave: 'square', duty: 0.5, name: 'Square' };
  // Past Square, the pulse narrows: 50% down to 6%.
  const duty = 0.5 - ((v - 0.55) / 0.45) * 0.44;
  return { wave: 'square', duty, name: `Pulse ${Math.round(duty * 100)}%` };
}
/** Knob values that land in the middle of each Shape zone (for starting points and missions). */
export const SHAPE = { noiseOrTri: 0.1, saw: 0.3, square: 0.47 } as const;
export const isSquareOrPulse = (v: number) => v >= 0.4;

export function rFormat(spec: RetroSpec, v: number): string {
  switch (spec.kind) {
    case 'shape1':
      return shapeAt(v, 1).name;
    case 'shape2':
      return shapeAt(v, 2).name;
    case 'shapeMod':
      return Math.abs(v) < 0.005 ? 'Off' : `${v < 0 ? 'LFO' : 'Env'} ${Math.abs(v).toFixed(2)}`;
    case 'mix':
      // Like Logic: 1.00 is all Osc 1, 0.00 is all Osc 2.
      return (1 - v).toFixed(2);
    case 'semi':
      return `${v > 0 ? '+' : ''}${Math.round(v)}`;
    case 'cents':
      return `${v > 0 ? '+' : ''}${Math.round(v)} c`;
    case 'bipolar':
      return `${v > 0 ? '+' : ''}${v.toFixed(2)}`;
    case 'dB':
      return `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`;
    case 'Hz':
      return `${v < 10 ? v.toFixed(2) : v.toFixed(1)} Hz`;
    case 'ms':
      return v < 10 ? `${v.toFixed(2)} ms` : v < 1000 ? `${Math.round(v)} ms` : `${(v / 1000).toFixed(2)} s`;
    default:
      return v.toFixed(2);
  }
}

/** Cutoff's 0-1 number as Hz (20 Hz to 20 kHz, even steps per octave). */
export const cutoffHz = (c: number) => 20 * Math.pow(1000, Math.max(0, Math.min(1, c)));

/** A plain starting point: two Saws, filter open, nothing moving, envelopes like Retro Synth's own. */
export const RETRO_BASE: RetroPatch = {
  shape1: SHAPE.saw,
  shape2: SHAPE.saw,
  shapeMod: 0,
  vibrato: 0,
  semitones: 0,
  cents: 0,
  mix: 0.5,
  filterOn: true,
  filterType: 'lp24',
  cutoff: 0.8,
  res: 0,
  key: 0,
  filterLfo: 0,
  filterEnv: 0,
  volume: 0,
  sineLevel: 0,
  fxOn: false,
  fxType: 'chorus',
  fxMix: 0.5,
  fxRate: 0.6,
  glideOn: false,
  glideTime: 100,
  lfoWave: 'triangle',
  lfoRate: 2,
  lfoSync: false,
  lfoSyncDiv: 6,
  lfoAmount: 1,
  vibWave: 'triangle',
  vibRate: 6.4,
  vibSync: false,
  vibSyncDiv: 8,
  vibAmount: 1,
  fA: 0.4,
  fD: 520,
  fS: 0.76,
  fR: 270,
  fVel: 0.5,
  aA: 0.4,
  aD: 520,
  aS: 0.76,
  aR: 270,
  aVel: 0.5,
};

const OSC_LEVEL = 0.6;

/** The Retro Synth panel's settings as the app engine's settings. */
export function toSynthParams(r: RetroPatch): SynthParams {
  const sec = (ms: number) => Math.max(0.001, ms / 1000);
  const s1 = shapeAt(r.shape1, 1);
  const s2 = shapeAt(r.shape2, 2);
  // An even-power crossfade, so the middle of Mix isn't louder or quieter than the ends.
  const l1 = Math.cos((r.mix * Math.PI) / 2) * OSC_LEVEL;
  const l2 = Math.sin((r.mix * Math.PI) / 2) * OSC_LEVEL;
  const on = r.filterOn;
  return {
    ...DEFAULT_SYNTH_PARAMS,
    masterVolume: Math.min(1.5, 0.75 * Math.pow(10, r.volume / 20)),
    vco1Waveform: s1.wave,
    vco1Level: l1,
    vco1PulseWidth: s1.duty,
    vco1Octave: 0,
    vco1Semi: 0,
    vco1Fine: 0,
    vco2Waveform: s2.wave,
    vco2Level: l2,
    vco2PulseWidth: s2.duty,
    vco2Octave: 0,
    vco2Semi: Math.round(r.semitones),
    vco2Fine: Math.round(r.cents),
    noiseLevel: 0,
    oscBalance: 0,
    filterCutoff: on ? cutoffHz(r.cutoff) : 20000,
    filterResonance: on ? 0.7 + Math.pow(r.res, 1.6) * 17 : 0.7,
    filterEnvAmount: on ? r.filterEnv * 100 : 0,
    filterKeyTracking: on ? r.key : 0,
    filterRolloff: r.filterType === 'lp24' ? -24 : -12,
    ampAttack: sec(r.aA),
    ampDecay: sec(r.aD),
    ampSustain: r.aS,
    ampRelease: sec(r.aR),
    modAttack: sec(r.fA),
    modDecay: sec(r.fD),
    modSustain: r.fS,
    modRelease: sec(r.fR),
    lfoRate: r.lfoSync ? divHz(r.lfoSyncDiv) : r.lfoRate,
    lfoWaveform: 'triangle',
    // The guide routes its two LFOs itself (toExtras); these are only for anything that reads one value.
    lfoDepth: r.filterLfo * r.lfoAmount,
    lfoDestination: 'cutoff',
    // Retro Synth glides polyphonically (toExtras: polyGlide), so chords still play.
    voiceMode: 'poly',
    glide: 0,
  };
}

/** The Retro Synth hardware the app's own synths don't have. */
export function toExtras(r: RetroPatch): EngineExtras {
  const on = r.filterOn;
  return {
    lfoAmounts: {
      pitch: r.vibrato * r.vibAmount,
      cutoff: on ? r.filterLfo * r.lfoAmount : 0,
      pwm: r.shapeMod < 0 ? -r.shapeMod * r.lfoAmount : 0,
    },
    modLfos: {
      main: { rate: r.lfoSync ? divHz(r.lfoSyncDiv) : r.lfoRate, shape: r.lfoWave },
      vibrato: { rate: r.vibSync ? divHz(r.vibSyncDiv) : r.vibRate, shape: r.vibWave },
    },
    pwmEnv: r.shapeMod > 0 ? r.shapeMod : 0,
    sineLevel: r.sineLevel * OSC_LEVEL,
    filterType: on && r.filterType === 'hp' ? 'highpass' : 'lowpass',
    effect: r.fxOn ? { type: r.fxType, mix: r.fxMix, rate: r.fxRate } : undefined,
    polyGlide: r.glideOn ? r.glideTime / 1000 : 0,
  };
}

// ---------- The guide ----------

/** Panel sections, used to glow the part of the Retro Synth a step is about. */
export type RsSection = 'osc' | 'filter' | 'amp' | 'effect' | 'glide' | 'lfo' | 'filterEnv' | 'ampEnv';
/** Parts of the Retro Synth signal-path diagram. */
export type RsFlow = 'osc' | 'filter' | 'amp' | 'effect' | 'sine' | 'filterEnv' | 'ampEnv' | 'lfo' | 'vibrato';

export type RsStep = GuideStep<RetroPatch> & { sections: RsSection[]; flow: RsFlow[] };

const divIs = (i: number, label: string) => SYNC_DIVS[i]?.label === label;

/** SynthLab name → Retro Synth name, for step 1. */
export const RETRO_NAME_MAP: NameRow[] = [
  { synthlab: 'VCO 1 + VCO 2, Waveform', theirs: 'OSCILLATOR: Shape 1, Shape 2', note: 'one knob sweeps through the waves' },
  { synthlab: 'VCO 1 / VCO 2 levels', theirs: 'OSCILLATOR: Mix', note: 'a slider from Osc 1 (1.00) to Osc 2 (0.00)' },
  { synthlab: 'VCO 2 Semi, Fine', theirs: 'OSCILLATOR: Semitones, Cents', note: 'they tune Osc 2' },
  { synthlab: 'Pulse Width', theirs: 'Shape turned past Square' },
  { synthlab: 'Noise', theirs: 'Shape 1 turned all the way left' },
  { synthlab: 'Cutoff, Resonance', theirs: 'FILTER: Cutoff, Res', note: '0 to 1 numbers in the orange screen' },
  { synthlab: 'Key Track', theirs: 'FILTER: Key slider' },
  { synthlab: 'EG Amount', theirs: 'FILTER: Env knob', note: 'middle is off; left flips it' },
  { synthlab: 'Filter EG', theirs: 'FILTER ENV' },
  { synthlab: 'Amp EG', theirs: 'AMP ENV' },
  { synthlab: 'LFO Rate, Waveform', theirs: 'LFO and VIBRATO tabs', note: 'two separate LFOs' },
  { synthlab: 'LFO Depth + Target', theirs: 'FILTER: LFO knob · OSCILLATOR: Vibrato, Shape Modulation' },
  { synthlab: 'Master volume', theirs: 'AMP: Volume' },
  { synthlab: 'Mono + Glide', theirs: 'Glide' },
  { synthlab: '(new)', theirs: 'Sine Level, Effect (Flanger / Chorus), filter type' },
];

export const RS_STEPS: RsStep[] = [
  {
    title: 'Familiar parts, new places',
    short: 'New names',
    sections: ['osc', 'filter', 'amp', 'filterEnv', 'ampEnv', 'lfo'],
    flow: ['osc', 'filter', 'amp', 'filterEnv', 'ampEnv', 'lfo'],
    what:
      'Retro Synth is the closest of the DAW synths to SynthLab. It has two oscillators with a Mix slider between them, a filter, an amp, and two envelopes: FILTER ENV for the cutoff and AMP ENV for the volume, just like SynthLab’s Filter EG and Amp EG. Most knobs only have new names or new places. Logic shows Cutoff, Res and Sustain as numbers from 0 to 1, so this copy does too, which means you can copy settings straight across.',
    listen: 'It should sound familiar: same building blocks, new panel.',
    start: {},
    phrase: run(['C3', 'E3', 'G3', 'C4'], 0.5, 0.45),
    missions: [
      { text: 'Find your Cutoff. In the FILTER screen, drag Cutoff down below 0.40 and listen.', check: (p) => p.cutoff < 0.4 },
      { text: 'Find your Release. In AMP ENV, drag R up to 1 second (1.00 s) or more and listen to the notes ring.', check: (p) => p.aR >= 1000 },
    ],
    extra: 'names',
  },
  {
    title: 'Two oscillators and a Mix slider',
    short: 'Oscillators',
    sections: ['osc'],
    flow: ['osc'],
    what:
      'Shape 1 and Shape 2 are the Waveform knobs of Osc 1 and Osc 2. Instead of clicking between waves, each knob sweeps through them. Shape 1 goes Noise, Saw, Square; Shape 2 goes Triangle, Saw, Square. Turn past Square and the pulse gets thinner (more on that next step). Mix is the balance between them: all the way up is only Osc 1, all the way down is only Osc 2. Semitones and Cents tune Osc 2, like VCO 2’s Semi and Fine in SynthLab.',
    listen: 'Saw is bright and buzzy, Square is hollow. A 5th up sounds like a power chord; a few cents makes it thick and moving.',
    start: { shape1: SHAPE.saw, shape2: SHAPE.saw, mix: 0.5, cutoff: 0.8 },
    phrase: run(['A2', 'C3', 'E3', 'A3'], 0.5, 0.45),
    missions: [
      {
        text: 'Slide Mix all the way up to Osc 1 (1.00), then turn Shape 1 to Square.',
        check: (p) => p.mix <= 0.02 && shapeAt(p.shape1, 1).name === 'Square',
      },
      {
        text: 'Slide Mix back to the middle (0.40 to 0.60) and set Semitones to +7, a 5th above.',
        check: (p) => p.mix >= 0.4 && p.mix <= 0.6 && p.semitones === 7,
      },
      { text: 'Set Semitones back to 0, then turn Cents to +10 or more for the thick, detuned sound from Learn.', check: (p) => p.semitones === 0 && p.cents >= 10 && p.mix >= 0.3 && p.mix <= 0.7 },
    ],
  },
  {
    title: 'Pulse width and Shape Modulation',
    short: 'Shape Mod',
    sections: ['osc', 'filterEnv'],
    flow: ['osc', 'lfo', 'filterEnv'],
    what:
      'Turning Shape past Square is your Pulse Width: the further right, the thinner and more nasal the pulse. Shape Modulation moves the shape for you. It is two knobs in one: turn it left (toward LFO) and the LFO sweeps the pulse width back and forth for a moving, shimmering sound. Turn it right (toward Filter Env) and the filter envelope pushes the pulse width on every note. In the middle it does nothing. It changes Square and Pulse shapes the most.',
    listen: 'Thinner pulse: reedier. Toward LFO: a shimmer that never sits still. Toward Filter Env: each note’s tone bends as it starts.',
    start: { shape1: SHAPE.square, shape2: SHAPE.saw, mix: 0, cutoff: 0.8, lfoRate: 1.5, lfoWave: 'triangle', fA: 0.4, fD: 700, fS: 0, fR: 300 },
    phrase: [one('D3', 1.4), one('A3', 1.4, 1.5)],
    missions: [
      {
        text: 'Turn Shape 1 past Square until it reads Pulse 25% or thinner.',
        check: (p) => p.shape1 >= 0.55 && shapeAt(p.shape1, 1).duty <= 0.25,
      },
      {
        text: 'Turn Shape 1 back to Square, then turn Shape Modulation left toward LFO, to LFO 0.50 or more.',
        check: (p) => isSquareOrPulse(p.shape1) && p.shapeMod <= -0.5,
      },
      { text: 'Now turn Shape Modulation right, toward Filter Env, to Env 0.50 or more.', check: (p) => isSquareOrPulse(p.shape1) && p.shapeMod >= 0.5 },
    ],
  },
  {
    title: 'The filter: Cutoff, Res, Key and type',
    short: 'Filter',
    sections: ['filter'],
    flow: ['filter'],
    what:
      'The orange screen is the filter you know: drag Cutoff and Res up or down. Key (keyboard tracking) makes the cutoff follow the keys, so high notes come out brighter and low notes darker, like a real instrument. The menu above the screen picks the filter type. LP 24dB is a steep low-pass like SynthLab’s, LP 12dB is gentler, and HP (high-pass) does the opposite job: it cuts the lows and keeps the highs.',
    listen: 'Low-pass: bright to dark, with a ringing peak from Res. High-pass: the bottom of the sound disappearing.',
    start: { cutoff: 0.65 },
    phrase: [one('C2', 0.8), one('C3', 0.8, 0.9), one('C4', 0.8, 1.8), one('C5', 0.8, 2.7)],
    missions: [
      { text: 'Set Cutoff between 0.45 and 0.55 and Res to 0.50 or more.', check: (p) => p.filterType === 'lp24' && p.cutoff >= 0.45 && p.cutoff <= 0.55 && p.res >= 0.5 },
      { text: 'Switch the filter type menu to HP 12dB and hear the lows disappear.', check: (p) => p.filterType === 'hp' },
      {
        text: 'Switch back to LP 24dB, then raise the Key slider to 0.70 or more. Listen to low and high notes: the high ones should be brighter.',
        check: (p) => p.filterType === 'lp24' && p.key >= 0.7,
      },
    ],
  },
  {
    title: 'Two envelopes, like SynthLab',
    short: 'Envelopes',
    sections: ['filter', 'filterEnv', 'ampEnv'],
    flow: ['filterEnv', 'filter', 'ampEnv', 'amp'],
    what:
      'Good news: this works just like SynthLab. FILTER ENV moves the cutoff, and the filter’s Env knob is your EG Amount. AMP ENV shapes the volume on its own. One difference: the Env knob starts in the middle, which is off. Right of center pushes the cutoff up; left of center flips the envelope so it pushes the cutoff down. In the orange screens, drag the dots, or drag A, D, S or R up or down. The Vel sliders set how much playing harder changes things (this copy plays every note at the same strength).',
    listen: 'A pluck in the brightness; then the volume plucking too, like a plucked string; then a slow brass-like swell as the filter opens.',
    start: { cutoff: 0.4, res: 0.2, filterEnv: 0, fA: 0.4, fD: 900, fS: 0.6, fR: 300, aA: 1, aD: 500, aS: 1, aR: 300 },
    phrase: run(['D2', 'F2', 'A2', 'D3'], 1, 0.9),
    missions: [
      {
        text: 'Make a pluck: turn the filter’s Env knob right to +0.80 or more, then in FILTER ENV set S to 0 and D between 300 and 600 ms.',
        check: (p) => p.filterEnv >= 0.8 && p.fS <= 0.02 && p.fD >= 300 && p.fD <= 600 && p.cutoff < 0.55,
      },
      {
        text: 'Now make the volume pluck too: in AMP ENV set S to 0 and D between 300 and 600 ms. Both envelopes together sound like a plucked string.',
        check: (p) => p.aS <= 0.02 && p.aD >= 300 && p.aD <= 600 && p.filterEnv >= 0.8,
      },
      {
        text: 'Brass swell: set AMP ENV S back to 1.00, then in FILTER ENV set A to 400 ms or more. Each note now opens up slowly.',
        check: (p) => p.aS >= 0.95 && p.fA >= 400 && p.filterEnv >= 0.8,
      },
    ],
  },
  {
    title: 'Two LFOs: LFO and Vibrato',
    short: 'LFO + Vibrato',
    sections: ['lfo', 'osc', 'filter'],
    flow: ['lfo', 'vibrato', 'osc', 'filter'],
    what:
      'SynthLab has one LFO; Retro Synth has two, on the LFO and VIBRATO tabs. Each has its own wave, Rate and Sync, and the tall slider beside the screen sets how strong that LFO is overall. VIBRATO moves the pitch: its depth is the Vibrato knob in OSCILLATOR. LFO moves the cutoff (the LFO knob in FILTER) and the pulse width (Shape Modulation turned toward LFO). Because they are separate, you can have slow vibrato and a fast wobble at once. Sync locks the Rate to the song’s tempo, so it steps through note values (1/4, 1/8, 1/16T…) instead of Hz.',
    listen: 'Vibrato: the pitch wavering. Synced wobble: the tone pulsing in time. A new wave shape: a different kind of wobble.',
    start: { cutoff: 0.6, res: 0.3, aS: 1, aR: 400, lfoWave: 'triangle', lfoRate: 2, vibRate: 3 },
    phrase: [one('A3', 2.6)],
    missions: [
      {
        text: 'Vibrato: turn the Vibrato knob in OSCILLATOR to 0.30 or more. Then open the VIBRATO tab and set its Rate between 4 and 8 Hz.',
        check: (p) => p.vibrato >= 0.3 && p.vibAmount >= 0.5 && !p.vibSync && p.vibRate >= 4 && p.vibRate <= 8,
      },
      {
        text: 'Wobble in time: on the LFO tab, turn Sync On and set the Rate to 1/8. Then turn the LFO knob in FILTER to 0.40 or more.',
        check: (p) => p.lfoSync && divIs(p.lfoSyncDiv, '1/8') && p.filterLfo >= 0.4 && p.lfoAmount >= 0.5,
      },
      {
        text: 'On the LFO tab, pick the square or the random-steps wave and hear how the wobble changes.',
        check: (p) => (p.lfoWave === 'square' || p.lfoWave === 'random') && p.filterLfo >= 0.4,
      },
    ],
  },
  {
    title: 'Effect and Glide',
    short: 'Extras',
    sections: ['effect', 'glide'],
    flow: ['effect'],
    what:
      'Two extras at the edges of the panel. EFFECT is a Flanger or Chorus: turn it on with its power button, pick one in the menu, and set Mix (how much) and Rate (how fast it moves). Glide is like SynthLab’s Glide, but it works on chords too: turn it on with its power button, and Time sets how long the pitch slides from one note (or chord) to the next.',
    listen: 'Chorus: wider and shimmering; Flanger: a sweeping jet sound. Glide: notes sliding into each other.',
    start: { cutoff: 0.6, aA: 10, aD: 800, aS: 0.7, aR: 500 },
    phrase: run(['C3', 'G3', 'E3', 'C4', 'G3'], 0.4, 0.38),
    missions: [
      { text: 'Turn on the Effect with its power button, and set its Mix to 0.50 or more (Chorus or Flanger).', check: (p) => p.fxOn && p.fxMix >= 0.5 },
      { text: 'Turn on Glide with its power button, set Time to 200 ms or more, and play a few notes in a row.', check: (p) => p.glideOn && p.glideTime >= 200 },
    ],
  },
];

// ---------- Settings to try ----------

export const RETRO_STARTING_POINTS: GuideStartingPoint<RetroPatch>[] = [
  {
    name: 'Deep Bass',
    what: 'Saw plus a Square an octave down, a low filter with a quick pluck, and a little Sine Level for weight.',
    phrase: 'bassRiff',
    transpose: 7,
    patch: {
      shape1: SHAPE.saw, shape2: SHAPE.square, semitones: -12, mix: 0.45, cutoff: 0.45, res: 0.2, key: 0.4, filterEnv: 0.5,
      fA: 0.4, fD: 300, fS: 0.2, fR: 120, aA: 0.4, aD: 400, aS: 0.8, aR: 120, sineLevel: 0.3, volume: -4,
    },
  },
  {
    name: 'Lush Pad',
    what: 'Two Saws detuned by a few cents, slow envelopes, a slow LFO on the cutoff and Chorus.',
    phrase: 'padChords',
    patch: {
      shape1: SHAPE.saw, shape2: SHAPE.saw, cents: 12, mix: 0.5, cutoff: 0.62, res: 0.1, filterEnv: 0.15, filterLfo: 0.15, lfoRate: 0.3,
      fA: 600, fD: 1500, fS: 0.7, fR: 1500, aA: 800, aD: 1500, aS: 0.8, aR: 1500, fxOn: true, fxType: 'chorus', fxMix: 0.5, fxRate: 0.5, volume: -6,
    },
  },
  {
    name: 'Funky Pluck',
    what: 'A thin Pulse with a Saw underneath, resonant filter and a short, snappy filter envelope.',
    phrase: 'pluckArp',
    patch: {
      shape1: 0.75, shape2: SHAPE.saw, mix: 0.3, cutoff: 0.4, res: 0.45, key: 0.5, filterEnv: 0.7,
      fA: 0.4, fD: 250, fS: 0, fR: 200, aA: 0.4, aD: 350, aS: 0, aR: 200,
    },
  },
  {
    name: 'Wobble Bass',
    what: 'Saw plus a Square an octave down, with the LFO synced to 1/8 notes wobbling the cutoff.',
    phrase: 'bassRiff',
    transpose: 7,
    patch: {
      shape1: SHAPE.saw, shape2: SHAPE.square, semitones: -12, mix: 0.5, cutoff: 0.42, res: 0.4, filterLfo: 0.55, lfoSync: true, lfoSyncDiv: 6,
      lfoWave: 'triangle', aA: 0.4, aD: 500, aS: 1, aR: 150, volume: -4,
    },
  },
  {
    name: 'Vintage Lead',
    what: 'Two slightly detuned Saws, a touch of filter envelope, vibrato, Glide and a gentle Flanger.',
    phrase: 'leadLine',
    patch: {
      shape1: SHAPE.saw, shape2: SHAPE.saw, cents: 8, mix: 0.5, cutoff: 0.62, res: 0.25, key: 0.5, filterEnv: 0.3,
      fA: 0.4, fD: 600, fS: 0.5, fR: 250, aA: 10, aD: 600, aS: 0.85, aR: 250, vibrato: 0.25, vibRate: 5.5,
      glideOn: true, glideTime: 80, fxOn: true, fxType: 'flanger', fxMix: 0.3, fxRate: 0.3,
    },
  },
];

// ---------- Progress (kept like Learn's: this visit, autosave and the submission code) ----------

const tracker = makeGuideProgress(RS_STEPS);
export const retroProgress = tracker.progress;
export const retroSummary = tracker.summary;
export const restoreRetroSteps = tracker.restoreSteps;
export const retroDoneSnapshot = tracker.snapshot;
export const restoreRetroDone = tracker.restoreDone;
