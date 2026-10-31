import { SynthParams, ThemeMode } from '../types';
import { DEFAULT_SYNTH_PARAMS } from './presets';
import { PhraseNote } from './playback';

/** Parts of the signal path, lit up in the Learn tab's flow strip. */
export type FlowPart = 'osc' | 'noise' | 'filter' | 'amp' | 'filterEnv' | 'ampEnv' | 'lfo';

export interface Mission {
  /** May contain {knob} names that change with the synth layout (see KNOB_NAMES). */
  text: string;
  check: (p: SynthParams) => boolean;
}

export interface LearnStep {
  title: string;
  /** Panel of the synth to glow. */
  section: 'vco' | 'filter' | 'envelope' | 'lfo';
  /** Also ring one knob that lives in another panel (the Filter EG Amount knob sits in the Filter section). */
  knob?: 'envAmt';
  flow: FlowPart[];
  what: string;
  listen: string;
  /** Settings loaded when the step opens (on top of LEARN_BASE). */
  start: Partial<SynthParams>;
  phrase: PhraseNote[];
  missions: Mission[];
  extra?: 'waves' | 'ampEnv' | 'filterEnv';
  /** A nudge to watch the oscilloscope while trying this step. */
  scope?: string;
}

/** A plain, neutral starting patch: one sawtooth, filter open, nothing moving. */
export const LEARN_BASE: SynthParams = {
  ...DEFAULT_SYNTH_PARAMS,
  vco1Waveform: 'sawtooth',
  vco1Level: 0.8,
  vco1PulseWidth: 0.5,
  vco2Waveform: 'sawtooth',
  vco2Level: 0,
  vco2Fine: 0,
  vco2Octave: 0,
  noiseLevel: 0,
  filterCutoff: 20000,
  filterResonance: 0.7,
  filterEnvAmount: 0,
  ampAttack: 0.01,
  ampDecay: 0.3,
  ampSustain: 0.8,
  ampRelease: 0.3,
  modAttack: 0.005,
  modDecay: 0.3,
  modSustain: 0,
  modRelease: 0.3,
  lfoRate: 5,
  lfoWaveform: 'triangle',
  lfoDepth: 0,
  lfoDestination: 'pitch',
};

/** The two synth layouts name a few knobs differently. */
export const KNOB_NAMES: Record<string, Record<ThemeMode, string>> = {
  envAmt: { 'studio-retro': 'EG Amount', 'hardware-bench': 'EG Amount' },
  lfoDepth: { 'studio-retro': 'LFO Depth', 'hardware-bench': 'LFO Depth' },
  vco2Fine: { 'studio-retro': 'VCO 2 Fine Detune', 'hardware-bench': 'VCO 2 Pitch / Detune' },
  noise: { 'studio-retro': 'White Noise', 'hardware-bench': 'Noise' },
  res: { 'studio-retro': 'Resonance (Q)', 'hardware-bench': 'Resonance' },
};

export const fillKnobNames = (text: string, theme: ThemeMode) =>
  text.replace(/\{(\w+)\}/g, (m, k) => KNOB_NAMES[k]?.[theme] ?? m);

const one = (note: string, dur: number, at = 0): PhraseNote => ({ note, at, dur });
const run = (notes: string[], step: number, dur: number): PhraseNote[] => notes.map((n, i) => one(n, dur, i * step));
const SMOOTH = ['sine', 'triangle'];
const dutyOff = (d: number) => Math.abs(d - 0.5);

export const LEARN_STEPS: LearnStep[] = [
  {
    title: 'Waveforms: the raw sound',
    section: 'vco',
    flow: ['osc'],
    what:
      'Every synth sound starts as a raw wave from an oscillator (VCO). Each wave shape has its own mix of harmonics: extra, higher frequencies stacked above the note that give it its color. More harmonics means a brighter, buzzier sound.',
    listen: 'Saw is bright and buzzy. Square is hollow, like a clarinet or an 8-bit game. Triangle and Sine are soft and pure.',
    scope: 'Watch the oscilloscope as you switch waves. Saw is a ramp, Square is a flat-topped box, Triangle is a zig-zag, Sine is one smooth curve. More corners and edges means more harmonics, so a brighter sound.',
    start: {},
    phrase: run(['C3', 'G3', 'C4'], 0.55, 0.45),
    missions: [
      { text: 'Switch VCO 1 to Square and listen.', check: (p) => p.vco1Waveform === 'square' },
      { text: 'Now try a smooth wave: Triangle or Sine.', check: (p) => SMOOTH.includes(p.vco1Waveform) },
    ],
    extra: 'waves',
  },
  {
    title: 'Two oscillators',
    section: 'vco',
    flow: ['osc'],
    what:
      'A second oscillator (VCO 2) makes the sound bigger. Tune it slightly away from VCO 1 and the two waves drift in and out of line, which makes a slow wobble called “beating.” Detune is measured in cents: 100 cents is one semitone, so 10 cents is a tiny change.',
    listen: 'A thicker, wider tone, then slow wobbling once VCO 2 is detuned.',
    scope: 'Watch the oscilloscope: with VCO 2 detuned, the wave slowly changes shape and swells and shrinks. That is the beating you hear.',
    start: {},
    phrase: [one('A2', 1.8), one('E3', 1.6, 2.0)],
    missions: [
      { text: 'Turn VCO 2 Level up to 50% or more.', check: (p) => p.vco2Level >= 0.5 },
      { text: 'Detune it: set {vco2Fine} to 10 cents or more (either direction).', check: (p) => p.vco2Level >= 0.3 && Math.abs(p.vco2Fine) >= 10 },
      { text: 'Stack an octave: set VCO 2 Octave to −1 or +1.', check: (p) => p.vco2Level >= 0.3 && p.vco2Octave !== 0 },
    ],
  },
  {
    title: 'Pulse width',
    section: 'vco',
    flow: ['osc'],
    what:
      'A square wave spends half its time up and half down: 50%. The Pulse Width knob makes it lopsided. The further you move from 50%, the thinner and more nasal it sounds, like an oboe or a funky clavinet.',
    listen: 'The tone getting thinner and reedier as you move away from 50%.',
    scope: 'Watch the oscilloscope as you turn Pulse Width. The flat top gets shorter and the bottom gets longer: the wave spends less time up than down. That lopsided shape is what you hear as thinner and nasal.',
    start: { vco1Waveform: 'square', vco1PulseWidth: 0.5 },
    phrase: run(['D3', 'F#3', 'A3'], 0.55, 0.45),
    missions: [
      {
        text: 'With VCO 1 on Square, set Pulse Width to 25% or less, or 75% or more.',
        check: (p) => p.vco1Waveform === 'square' && dutyOff(p.vco1PulseWidth) >= 0.25,
      },
    ],
  },
  {
    title: 'Noise',
    section: 'vco',
    flow: ['noise'],
    what:
      'White noise has no pitch at all. It is every frequency at once, like static or a hiss. Synths use it for breath, wind, snare drums and whooshes.',
    listen: 'A hiss under the tone, then pure noise with no musical note in it.',
    scope: 'Watch the oscilloscope as you add noise: the clean wave turns fuzzy and jagged, and with only noise there is no repeating shape at all.',
    start: {},
    phrase: [one('C3', 1.2)],
    missions: [
      { text: 'Turn {noise} up to 30% or more.', check: (p) => p.noiseLevel >= 0.3 },
      {
        text: 'Turn VCO 1 Level down to 0 so you hear only noise.',
        check: (p) => p.noiseLevel >= 0.3 && p.vco1Level <= 0.02 && p.vco2Level <= 0.02,
      },
    ],
  },
  {
    title: 'Filter cutoff',
    section: 'filter',
    flow: ['osc', 'filter'],
    what:
      'This is the “subtractive” part. A low-pass filter lets low frequencies through and cuts the highs above its Cutoff. Turning the Cutoff down takes harmonics away: buzzy, then warm, then muffled.',
    listen: 'The sound going from bright to dark, like music moving from in the room to behind a wall.',
    scope: 'Watch the oscilloscope as you lower the Cutoff: sharp corners round off and the wave smooths toward a sine. Harmonics are being removed.',
    start: { vco2Level: 0.6, vco2Fine: 8 },
    phrase: run(['F3', 'A3', 'C4'], 0.65, 0.55),
    missions: [
      { text: 'Turn Cutoff down below 1,500 Hz.', check: (p) => p.filterCutoff <= 1500 },
      { text: 'Find a muffled spot: Cutoff below 400 Hz.', check: (p) => p.filterCutoff <= 400 },
    ],
  },
  {
    title: 'Resonance',
    section: 'filter',
    flow: ['filter'],
    what:
      'Resonance boosts the frequencies right at the Cutoff, adding a peak. A little gives a vocal, “wah” quality. A lot makes a sharp whistle that follows wherever the Cutoff goes.',
    listen: 'A ringing, whistly peak riding on top of the sound.',
    start: { filterCutoff: 1000 },
    phrase: [one('G2', 1.0), one('D3', 1.0, 1.1)],
    missions: [
      { text: 'Turn {res} up to 8 or more.', check: (p) => p.filterResonance >= 8 },
      {
        text: 'Keep it high and move Cutoff to a new spot: below 500 Hz or above 2,500 Hz.',
        check: (p) => p.filterResonance >= 8 && (p.filterCutoff <= 500 || p.filterCutoff >= 2500),
      },
    ],
  },
  {
    title: 'Amp envelope',
    section: 'envelope',
    flow: ['amp', 'ampEnv'],
    what:
      'The Amp Envelope (the Amp EG tab in the Envelope section) shapes the volume every time you press a key. Attack: how fast it fades in. Decay: how fast it drops to the Sustain level. Sustain: the level while you hold the key. Release: how long it fades after you let go.',
    listen: 'A pluck is a quick “tick” that dies away. A pad swells in slowly and lingers after you let go.',
    start: { filterCutoff: 5000, ampSustain: 0, ampDecay: 0.9 },
    phrase: [one('C3', 1.4), one('E3', 1.4), one('G3', 1.4), one('C4', 0.5, 2.6)],
    missions: [
      { text: 'Make a pluck: Sustain starts at 0, so the note dies away on its own. Shorten Amp Decay to 0.3 s or less to tighten it.', check: (p) => p.ampSustain <= 0.05 && p.ampDecay <= 0.3 },
      {
        text: 'Now a pad: Attack 0.5 s or longer, Sustain 50% or more, Release 1.5 s or longer.',
        check: (p) => p.ampAttack >= 0.5 && p.ampSustain >= 0.5 && p.ampRelease >= 1.5,
      },
    ],
    extra: 'ampEnv',
  },
  {
    title: 'Filter envelope',
    section: 'envelope',
    knob: 'envAmt',
    flow: ['filter', 'filterEnv'],
    what:
      'The Filter Envelope (Filter EG) moves the Cutoff for you every time you press a key. The {envAmt} knob in the Filter section sets how far it moves. Its timing (Attack, Decay, Sustain, Release) is in the Envelope section: click the Filter EG tab. This is the classic “bwow” of synth bass and brass.',
    listen: 'Each note opening up bright, then closing back down.',
    start: { filterCutoff: 300, filterResonance: 3, modDecay: 0.6, modSustain: 0.3 },
    phrase: run(['D2', 'F2', 'A2', 'D3'], 0.5, 0.42),
    missions: [
      { text: 'In the Filter section, turn {envAmt} up to 50% or more.', check: (p) => p.filterEnvAmount >= 50 },
      {
        text: 'Make it snappy. In the Envelope section, click the Filter EG tab, then set Decay to 0.25 s or shorter and Sustain to 0.',
        check: (p) => p.filterEnvAmount >= 50 && p.modDecay <= 0.25 && p.modSustain <= 0.05,
      },
    ],
    extra: 'filterEnv',
  },
  {
    title: 'The LFO',
    section: 'lfo',
    flow: ['lfo', 'osc', 'filter'],
    what:
      'The LFO (low-frequency oscillator) is a slow wave you don’t hear directly. Instead it moves a knob for you, over and over. Send it to Pitch for vibrato, to Cutoff for a wobble, or to Pulse Width for shimmer.',
    listen: 'Vibrato: the pitch wavering. Wobble: the tone opening and closing in a rhythm.',
    scope: 'Watch the oscilloscope: Pitch makes the wave squeeze and stretch, Cutoff makes its sharp edges come and go, and Pulse Width makes the shape slowly change.',
    start: { filterCutoff: 900, filterResonance: 4, ampSustain: 1 },
    phrase: [one('A3', 2.4)],
    missions: [
      {
        text: 'Vibrato: LFO target Pitch, {lfoDepth} 15% or more, Rate between 4 and 8 Hz.',
        check: (p) => p.lfoDestination === 'pitch' && p.lfoDepth >= 0.15 && p.lfoRate >= 4 && p.lfoRate <= 8,
      },
      {
        text: 'Wobble: switch the target to Cutoff, {lfoDepth} 40% or more, Rate between 1 and 4 Hz.',
        check: (p) => p.lfoDestination === 'cutoff' && p.lfoDepth >= 0.4 && p.lfoRate >= 1 && p.lfoRate <= 4,
      },
    ],
  },
];
