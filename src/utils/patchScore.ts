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
      return clamp01(0.5 * (logGap(p.lfoRate, t.lfoRate, 0.1) / 0.9) + 0.5 * (Math.abs(p.lfoDepth - t.lfoDepth) / 0.6));
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

const forgive = (gap: number) => clamp01((gap - 0.15) / 0.85);

export function scorePatch(p: SynthParams, patch: PatchMatcherChallenge): PatchScore {
  const aspects = (Object.entries(patch.gradeOn) as [PatchAspect, number][]).map(([aspect, weight]) => ({
    aspect,
    label: ASPECT_LABELS[aspect],
    weight,
    // Close is close: the first 15% of distance costs nothing, so nobody chases perfection.
    gap: forgive(aspectGap(aspect, p, patch.targetParams)),
  }));
  const lost = aspects.reduce((s, a) => s + a.weight * a.gap, 0);
  return { score: Math.max(0, Math.min(100, Math.round(100 - lost))), aspects };
}

// ---------- Hints ----------
const LFO_TARGET_NAMES: Record<string, string> = { pitch: 'Pitch', cutoff: 'Filter Cutoff', pwm: 'Pulse Width' };

const tooHigh = (cur: number, tgt: number) => (cur > tgt ? 'too high' : 'too low');
const tooLong = (cur: number, tgt: number) => (cur > tgt ? 'too long' : 'too short');

/** A context-specific nudge: what is off right now, and which way to move it. */
function hintText(aspect: PatchAspect, p: SynthParams, t: SynthParams): string {
  switch (aspect) {
    case 'wave':
      return SMOOTH.includes(t.vco1Waveform)
        ? `Your VCO 1 waveform is too buzzy. The target is soft and mellow: try Triangle or Sine.`
        : SMOOTH.includes(p.vco1Waveform)
        ? 'Your VCO 1 waveform is too smooth. The target is brighter and buzzier: try Sawtooth or Square.'
        : `Your VCO 1 waveform is the wrong kind of buzzy. Compare Sawtooth (full, buzzy) with Square (hollow) and match the target.`;
    case 'octave':
      return `Your VCO 1 is pitched too ${p.vco1Octave > t.vco1Octave ? 'high' : 'low'}. Move the Octave switch ${p.vco1Octave > t.vco1Octave ? 'down' : 'up'}.`;
    case 'pulseWidth':
      return p.vco1Waveform !== 'square'
        ? 'This one needs VCO 1 on Square, with the Pulse Width knob moved away from 50%.'
        : `Your Pulse Width is too ${dutyGap(p.vco1PulseWidth, 0.5) < dutyGap(t.vco1PulseWidth, 0.5) ? 'close to 50%' : 'far from 50%'}. The target is ${
            dutyGap(t.vco1PulseWidth, 0.5) > 0.2 ? 'thin and nasal' : 'only a little squeezed'
          }.`;
    case 'osc2':
      return osc2On(t)
        ? osc2On(p)
          ? `Your VCO 2 level is too ${p.vco2Level > t.vco2Level ? 'loud' : 'quiet'}${p.vco2Waveform !== t.vco2Waveform ? ' (and check its waveform)' : ''}.`
          : 'Your VCO 2 is too quiet: the target has a second oscillator in the mix. Bring VCO 2 up.'
        : 'Your VCO 2 is too loud: the target is a single oscillator. Turn VCO 2 down.';
    case 'detune':
      return osc2On(t) && !osc2On(p)
        ? 'The target has slow, wobbling “beating.” Turn VCO 2 up, then detune it a little.'
        : `Your VCO 2 detune is ${tooHigh(Math.abs(p.vco2Fine), Math.abs(t.vco2Fine))}. The target is around ${Math.round(Math.abs(t.vco2Fine))} cents (either direction).`;
    case 'noise':
      return `Your noise level is ${tooHigh(p.noiseLevel, t.noiseLevel)}${t.noiseLevel < 0.2 ? ': the target only has a touch of it' : ''}.`;
    case 'oscMuted':
      return 'Your oscillators are too loud. There is no pitched tone in this sound at all: turn the VCO levels all the way down.';
    case 'cutoff':
      return `Your filter Cutoff is ${tooHigh(p.filterCutoff, t.filterCutoff)}. The target sounds ${p.filterCutoff > t.filterCutoff ? 'darker and more muffled' : 'brighter and more open'}.`;
    case 'resonance':
      return `Your Resonance is ${tooHigh(p.filterResonance, t.filterResonance)}. The target has ${p.filterResonance > t.filterResonance ? 'a gentler peak' : 'a more ringing, whistly peak'}.`;
    case 'filterEnv':
      return `Your Filter EG Amount (Filter section) is ${tooHigh(p.filterEnvAmount, t.filterEnvAmount)}.`;
    case 'filterDecay':
      return `Your Filter EG Decay (Envelope section, Filter EG tab) is ${tooLong(p.modDecay, t.modDecay)}.`;
    case 'attack':
      return `Your Amp Attack is too ${p.ampAttack > t.ampAttack ? 'slow' : 'fast'}. The target fades in ${p.ampAttack > t.ampAttack ? 'sooner' : 'more slowly'}.`;
    case 'decay':
      return `Your Amp Decay is ${tooLong(p.ampDecay, t.ampDecay)}. The target ${p.ampDecay > t.ampDecay ? 'drops away faster' : 'rings on longer'}.`;
    case 'sustain':
      return `Your Amp Sustain is ${tooHigh(p.ampSustain, t.ampSustain)}${t.ampSustain <= 0.05 ? ': the target dies away completely while you hold the key' : ''}.`;
    case 'release':
      return `Your Amp Release is ${tooLong(p.ampRelease, t.ampRelease)}. The target ${p.ampRelease > t.ampRelease ? 'stops sooner after you let go' : 'lingers longer after you let go'}.`;
    case 'lfo': {
      if (!lfoActive(t)) return 'Your LFO is moving things that should stay still. Turn LFO Depth down.';
      if (!lfoActive(p)) return `Your LFO is too quiet to hear. The target has it moving the ${LFO_TARGET_NAMES[t.lfoDestination]}: raise LFO Depth.`;
      if (p.lfoDestination !== t.lfoDestination) return `Your LFO is sent to the wrong place. The target has it moving the ${LFO_TARGET_NAMES[t.lfoDestination]}.`;
      if (logGap(p.lfoRate, t.lfoRate, 0.1) > 0.15) return `Your LFO Rate is too ${p.lfoRate > t.lfoRate ? 'fast' : 'slow'}.`;
      return `Your LFO Depth is ${tooHigh(p.lfoDepth, t.lfoDepth)}.`;
    }
  }
}

/**
 * The next hint: the graded aspect the student is furthest from right now (weighted),
 * skipping ones already hinted. Each hint says what is off and which way to move it.
 */
export function nextPatchHint(
  p: SynthParams,
  patch: PatchMatcherChallenge,
  alreadyShown: string[]
): { key: string; text: string } | null {
  const open = scorePatch(p, patch)
    .aspects.map((a) => ({ ...a, cost: a.weight * a.gap }))
    .filter((a) => a.cost >= 1 && !alreadyShown.includes(a.aspect))
    .sort((a, b) => b.cost - a.cost);
  const next = open[0];
  return next ? { key: next.aspect, text: hintText(next.aspect, p, patch.targetParams) } : null;
}
