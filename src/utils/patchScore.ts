import { SynthParams, PatchAspect, PatchMatcherChallenge } from '../types';

/**
 * Patch Master grading. Each patch lists the aspects that define its sound
 * (gradeOn, weights add up to 100). Each aspect gets a "distance" from 0 (spot on)
 * to 1 (way off); the score is 100 minus the weighted distances.
 */

const SMOOTH = ['sine', 'triangle'];
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
/** Distance between two values on a log scale, in decades, with a floor for tiny values. */
const logGap = (a: number, b: number, floor: number) =>
  Math.abs(Math.log10(Math.max(floor, a)) - Math.log10(Math.max(floor, b)));
/** Pulse widths d and 1-d sound the same, so compare against both. */
const dutyGap = (a: number, b: number) => Math.min(Math.abs(a - b), Math.abs(1 - a - b));
const waveGap = (a: string, b: string) => (a === b ? 0 : SMOOTH.includes(a) === SMOOTH.includes(b) ? 0.5 : 1);
/** VCO 2 counts as "on" when it's audibly in the mix. */
const osc2On = (p: SynthParams) => p.vco2Level >= 0.2 && p.vco2Waveform !== 'noise';
const lfoActive = (p: SynthParams) => p.lfoDepth >= 0.05;

export const ASPECT_LABELS: Record<PatchAspect, string> = {
  wave: 'VCO 1 waveform',
  octave: 'Octave (register)',
  pulseWidth: 'Pulse width',
  osc2: 'VCO 2 in the mix',
  detune: 'VCO 2 detune',
  noise: 'Noise level',
  oscMuted: 'Oscillators muted',
  cutoff: 'Filter cutoff',
  resonance: 'Resonance',
  filterEnv: 'Filter envelope amount',
  filterDecay: 'Filter envelope shape',
  attack: 'Amp attack',
  decay: 'Amp decay',
  sustain: 'Amp sustain',
  release: 'Amp release',
  lfo: 'LFO movement',
};

export function aspectGap(aspect: PatchAspect, p: SynthParams, t: SynthParams): number {
  switch (aspect) {
    case 'wave':
      return waveGap(p.vco1Waveform, t.vco1Waveform);
    case 'octave':
      return clamp01(Math.abs(p.vco1Octave - t.vco1Octave) / 2);
    case 'pulseWidth':
      return p.vco1Waveform !== 'square' ? 1 : clamp01(dutyGap(p.vco1PulseWidth, t.vco1PulseWidth) / 0.3);
    case 'osc2':
      return clamp01(0.7 * (Math.abs(p.vco2Level - t.vco2Level) / 0.6) + 0.3 * (osc2On(t) ? waveGap(p.vco2Waveform, t.vco2Waveform) : 0));
    case 'detune':
      if (osc2On(t) && !osc2On(p)) return 1;
      return clamp01(Math.abs(Math.abs(p.vco2Fine) - Math.abs(t.vco2Fine)) / 20);
    case 'noise':
      return clamp01(Math.abs(p.noiseLevel - t.noiseLevel) / 0.5);
    case 'oscMuted': {
      const heard = Math.max(p.vco1Waveform === 'noise' ? 0 : p.vco1Level, p.vco2Waveform === 'noise' ? 0 : p.vco2Level);
      return clamp01(heard / 0.4);
    }
    case 'cutoff':
      return clamp01(logGap(p.filterCutoff, t.filterCutoff, 20) / 1.2);
    case 'resonance':
      return clamp01(Math.abs(p.filterResonance - t.filterResonance) / 8);
    case 'filterEnv':
      return clamp01(Math.abs(p.filterEnvAmount - t.filterEnvAmount) / 60);
    case 'filterDecay':
      return clamp01(0.6 * logGap(p.modDecay, t.modDecay, 0.05) + 0.4 * Math.abs(p.modSustain - t.modSustain));
    case 'attack':
      return clamp01(logGap(p.ampAttack, t.ampAttack, 0.02) / 1.3);
    case 'decay':
      return clamp01(logGap(p.ampDecay, t.ampDecay, 0.05));
    case 'sustain':
      return clamp01(Math.abs(p.ampSustain - t.ampSustain));
    case 'release':
      return clamp01(logGap(p.ampRelease, t.ampRelease, 0.05));
    case 'lfo':
      if (!lfoActive(t)) return clamp01(p.lfoDepth / 0.3);
      if (!lfoActive(p) || p.lfoDestination !== t.lfoDestination) return 1;
      return clamp01(0.5 * (logGap(p.lfoRate, t.lfoRate, 0.1) / 0.7) + 0.5 * (Math.abs(p.lfoDepth - t.lfoDepth) / 0.5));
  }
}

export interface AspectResult {
  aspect: PatchAspect;
  label: string;
  weight: number;
  gap: number; // 0..1
}

export interface PatchScore {
  score: number; // 0..100
  aspects: AspectResult[];
}

export function scorePatch(p: SynthParams, patch: PatchMatcherChallenge): PatchScore {
  const aspects = (Object.entries(patch.gradeOn) as [PatchAspect, number][]).map(([aspect, weight]) => ({
    aspect,
    label: ASPECT_LABELS[aspect],
    weight,
    gap: aspectGap(aspect, p, patch.targetParams),
  }));
  const lost = aspects.reduce((s, a) => s + a.weight * a.gap, 0);
  return { score: Math.max(0, Math.min(100, Math.round(100 - lost))), aspects };
}

// ---------- Hints ----------
const nice = (n: number) => {
  if (n <= 0) return 0;
  return Number(n.toPrecision(n >= 10 ? 2 : 1));
};
const fmtTime = (s: number) => (s < 1 ? `${Math.round(nice(s * 1000))} ms` : `${nice(s)} s`);
const fmtHz = (n: number) => `${nice(n).toLocaleString()} Hz`;
const pct = (n: number) => `${Math.round(n * 100)}%`;

/** "should be above 3", "below 1,500 Hz", "between 2 & 5 Hz": points the right way without the exact value. */
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

const LFO_TARGET_NAMES: Record<string, string> = { pitch: 'Pitch', cutoff: 'Filter Cutoff', pwm: 'Pulse Width' };

function hintText(aspect: PatchAspect, p: SynthParams, t: SynthParams): string {
  switch (aspect) {
    case 'wave':
      return SMOOTH.includes(t.vco1Waveform)
        ? 'VCO 1 needs a smooth, mellow waveform (not a buzzy one).'
        : 'VCO 1 needs a bright, buzzy waveform (not a smooth one).';
    case 'octave':
      return t.vco1Octave < p.vco1Octave ? 'This sound sits lower. Try VCO 1’s Octave switch.' : 'This sound sits higher. Try VCO 1’s Octave switch.';
    case 'pulseWidth':
      return p.vco1Waveform !== 'square'
        ? 'This one uses VCO 1’s Square wave, with the Pulse Width knob moved away from 50%.'
        : 'The square wave here is thinner and more nasal. Move Pulse Width further from 50%.';
    case 'osc2':
      return osc2On(t) ? 'Listen for a second oscillator. Bring VCO 2 into the mix.' : 'This one is a single oscillator. Turn VCO 2 down.';
    case 'detune':
      return osc2On(t) && !osc2On(p)
        ? 'There’s slow wobbling “beating” in this sound. That needs VCO 2 turned up and detuned.'
        : rangeClue('VCO 2 Fine detune (either direction)', Math.abs(p.vco2Fine), Math.max(0, Math.abs(t.vco2Fine) - 5), Math.abs(t.vco2Fine) + 5, (n) => `${n} cents`);
    case 'noise':
      return rangeClue('Noise level', p.noiseLevel, Math.max(0, t.noiseLevel - 0.2), Math.min(1, t.noiseLevel + 0.2), pct);
    case 'oscMuted':
      return 'There’s no pitched tone in this sound at all. Turn both VCO levels all the way down.';
    case 'cutoff':
      return rangeClue('Filter Cutoff', p.filterCutoff, t.filterCutoff / 1.6, t.filterCutoff * 1.6, fmtHz);
    case 'resonance':
      return rangeClue('Filter Resonance', p.filterResonance, t.filterResonance * 0.6, t.filterResonance * 1.5 + 0.5, (n) => `${nice(n)}`);
    case 'filterEnv':
      return rangeClue('Filter Envelope Amount', p.filterEnvAmount, t.filterEnvAmount - 15, t.filterEnvAmount + 15, (n) => `${Math.round(n)}%`);
    case 'filterDecay':
      return t.modSustain <= 0.05
        ? `The filter snaps shut after each note: Filter Envelope Sustain near 0 and Decay ${t.modDecay < 0.5 ? 'short' : 'long'}.`
        : rangeClue('Filter Envelope Decay', p.modDecay, t.modDecay / 2, t.modDecay * 2, fmtTime, { up: 'longer than', down: 'shorter than' });
    case 'attack':
      return rangeClue('Amp Attack', p.ampAttack, t.ampAttack / 2, t.ampAttack * 2 + 0.005, fmtTime, { up: 'slower than', down: 'faster than' });
    case 'decay':
      return rangeClue('Amp Decay', p.ampDecay, t.ampDecay / 2, t.ampDecay * 2, fmtTime, { up: 'longer than', down: 'shorter than' });
    case 'sustain':
      return rangeClue(
        'Amp Sustain',
        p.ampSustain,
        Math.max(0, Math.floor((t.ampSustain - 0.15) * 10) / 10),
        Math.min(1, Math.ceil((t.ampSustain + 0.15) * 10) / 10),
        pct
      );
    case 'release':
      return rangeClue('Amp Release', p.ampRelease, t.ampRelease / 2, t.ampRelease * 2, fmtTime, { up: 'longer than', down: 'shorter than' });
    case 'lfo':
      if (!lfoActive(t)) return 'Nothing in this sound is wobbling. Turn LFO Depth down.';
      if (p.lfoDestination !== t.lfoDestination || !lfoActive(p))
        return `The LFO is moving the ${LFO_TARGET_NAMES[t.lfoDestination]}. Set the LFO target there and give it some depth.`;
      return `LFO Rate should be between ${nice(Math.max(0.1, t.lfoRate * 0.6))} & ${nice(t.lfoRate * 1.5)} Hz.`;
  }
}

/**
 * The next hint: the graded aspect the student is furthest from (weighted), skipping
 * ones already hinted. The first hint goes to the filter when it's off; only one
 * filter hint per patch.
 */
export function nextPatchHint(
  p: SynthParams,
  patch: PatchMatcherChallenge,
  alreadyShown: string[]
): { key: string; text: string } | null {
  const FILTER: PatchAspect[] = ['cutoff', 'resonance'];
  const filterUsed = alreadyShown.some((k) => FILTER.includes(k as PatchAspect));
  const open = scorePatch(p, patch)
    .aspects.map((a) => ({ ...a, cost: a.weight * a.gap }))
    .filter((a) => a.cost >= 2 && !alreadyShown.includes(a.aspect) && !(filterUsed && FILTER.includes(a.aspect)))
    .sort((a, b) => b.cost - a.cost);
  const firstFilter = alreadyShown.length === 0 ? open.find((a) => FILTER.includes(a.aspect)) : undefined;
  const next = firstFilter ?? open[0];
  return next ? { key: next.aspect, text: hintText(next.aspect, p, patch.targetParams) } : null;
}
