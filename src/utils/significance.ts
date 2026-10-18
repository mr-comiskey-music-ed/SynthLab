import { SynthParams } from '../types';

/**
 * "Significant" changes between two patches: changes big enough to hear,
 * so nudging a knob by a hair doesn't count. Used by the Remix challenge
 * (at least 3 required) and the from-scratch challenge.
 */

export interface Change {
  label: string;
  from: string;
  to: string;
}

const WAVE: Record<string, string> = { sine: 'Sine', triangle: 'Triangle', sawtooth: 'Saw', square: 'Square', noise: 'Noise' };
const LFO_TARGET: Record<string, string> = { pitch: 'Pitch', cutoff: 'Cutoff', pwm: 'Pulse width' };
const pct = (n: number) => `${Math.round(n * 100)}%`;
const time = (s: number) => (s < 1 ? `${Math.round(s * 1000)} ms` : `${Number(s.toFixed(2))} s`);
const hz = (n: number) => (n >= 1000 ? `${Number((n / 1000).toFixed(1))}k Hz` : `${Math.round(n)} Hz`);
/** Times and frequencies are compared by ratio: doubling or halving is a real change. */
const ratioOver = (a: number, b: number, floor: number, ratio: number) =>
  Math.max(floor, a) / Math.max(floor, b) >= ratio || Math.max(floor, b) / Math.max(floor, a) >= ratio;

interface Rule {
  label: string;
  changed: (p: SynthParams, b: SynthParams) => boolean;
  show: (p: SynthParams) => string;
}

const audible1 = (p: SynthParams) => p.vco1Level > 0.02;
const audible2 = (p: SynthParams) => p.vco2Level > 0.02;

const RULES: Rule[] = [
  { label: 'VCO 1 wave', changed: (p, b) => audible1(p) && p.vco1Waveform !== b.vco1Waveform, show: (p) => WAVE[p.vco1Waveform] },
  { label: 'VCO 1 octave', changed: (p, b) => p.vco1Octave !== b.vco1Octave, show: (p) => `${p.vco1Octave}` },
  { label: 'VCO 1 level', changed: (p, b) => Math.abs(p.vco1Level - b.vco1Level) >= 0.2, show: (p) => pct(p.vco1Level) },
  {
    label: 'Pulse width',
    changed: (p, b) => p.vco1Waveform === 'square' && Math.abs(p.vco1PulseWidth - b.vco1PulseWidth) >= 0.15,
    show: (p) => pct(p.vco1PulseWidth),
  },
  { label: 'VCO 2 wave', changed: (p, b) => audible2(p) && audible2(b) && p.vco2Waveform !== b.vco2Waveform, show: (p) => WAVE[p.vco2Waveform] },
  { label: 'VCO 2 level', changed: (p, b) => Math.abs(p.vco2Level - b.vco2Level) >= 0.2, show: (p) => pct(p.vco2Level) },
  {
    label: 'VCO 2 tuning',
    changed: (p, b) => audible2(p) && (p.vco2Octave !== b.vco2Octave || p.vco2Semi !== b.vco2Semi || Math.abs(p.vco2Fine - b.vco2Fine) >= 5),
    show: (p) => `oct ${p.vco2Octave}${p.vco2Semi ? `, ${p.vco2Semi} semi` : ''}, ${p.vco2Fine}¢`,
  },
  { label: 'Noise', changed: (p, b) => Math.abs(p.noiseLevel - b.noiseLevel) >= 0.15, show: (p) => pct(p.noiseLevel) },
  { label: 'Cutoff', changed: (p, b) => ratioOver(p.filterCutoff, b.filterCutoff, 20, 1.5), show: (p) => hz(p.filterCutoff) },
  { label: 'Resonance', changed: (p, b) => Math.abs(p.filterResonance - b.filterResonance) >= 2, show: (p) => p.filterResonance.toFixed(1) },
  { label: 'Filter EG amount', changed: (p, b) => Math.abs(p.filterEnvAmount - b.filterEnvAmount) >= 20, show: (p) => `${Math.round(p.filterEnvAmount)}%` },
  {
    label: 'Filter EG shape',
    changed: (p, b) =>
      Math.abs(p.filterEnvAmount) >= 10 &&
      (ratioOver(p.modAttack, b.modAttack, 0.01, 2) || ratioOver(p.modDecay, b.modDecay, 0.03, 2) || Math.abs(p.modSustain - b.modSustain) >= 0.2),
    show: (p) => `A ${time(p.modAttack)}, D ${time(p.modDecay)}, S ${pct(p.modSustain)}`,
  },
  { label: 'Amp attack', changed: (p, b) => ratioOver(p.ampAttack, b.ampAttack, 0.01, 2), show: (p) => time(p.ampAttack) },
  { label: 'Amp decay', changed: (p, b) => ratioOver(p.ampDecay, b.ampDecay, 0.03, 2), show: (p) => time(p.ampDecay) },
  { label: 'Amp sustain', changed: (p, b) => Math.abs(p.ampSustain - b.ampSustain) >= 0.2, show: (p) => pct(p.ampSustain) },
  { label: 'Amp release', changed: (p, b) => ratioOver(p.ampRelease, b.ampRelease, 0.03, 2), show: (p) => time(p.ampRelease) },
  {
    label: 'LFO',
    changed: (p, b) => {
      const on = (x: SynthParams) => x.lfoDepth >= 0.05;
      if (on(p) !== on(b)) return true;
      if (!on(p)) return false;
      return p.lfoDestination !== b.lfoDestination || Math.abs(p.lfoDepth - b.lfoDepth) >= 0.15 || ratioOver(p.lfoRate, b.lfoRate, 0.1, 1.5);
    },
    show: (p) => (p.lfoDepth >= 0.05 ? `${LFO_TARGET[p.lfoDestination]}, ${p.lfoRate.toFixed(1)} Hz, ${pct(p.lfoDepth)}` : 'off'),
  },
  {
    label: 'Voices / glide',
    changed: (p, b) => p.voiceMode !== b.voiceMode || (p.voiceMode === 'mono' && Math.abs(p.glide - b.glide) >= 0.05),
    show: (p) => (p.voiceMode === 'mono' ? `Mono${p.glide > 0 ? `, glide ${Math.round(p.glide * 1000)} ms` : ''}` : 'Poly'),
  },
];

export function significantChanges(p: SynthParams, base: SynthParams): Change[] {
  return RULES.filter((r) => r.changed(p, base)).map((r) => ({ label: r.label, from: r.show(base), to: r.show(p) }));
}
