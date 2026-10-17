import React from 'react';
import { SynthParams } from '../types';
import { DEFAULT_SYNTH_PARAMS } from '../utils/presets';

/**
 * A readable list of a patch's settings, grouped by section. Only the parts that are
 * actually in use are listed (e.g. VCO 2 only when it's turned up). Settings that
 * differ from the starting (Init) patch are highlighted, so a teacher can see at a
 * glance what the student changed.
 */

const WAVE: Record<string, string> = { sine: 'Sine', triangle: 'Triangle', sawtooth: 'Saw', square: 'Square', noise: 'Noise' };
const LFO_TARGET: Record<string, string> = { pitch: 'Pitch', cutoff: 'Cutoff', pwm: 'Pulse width' };

const pct = (n: number) => `${Math.round(n * 100)}%`;
const time = (s: number) => (s < 1 ? `${Math.round(s * 1000)} ms` : `${Number(s.toFixed(2))} s`);
const hz = (n: number) => (n >= 1000 ? `${Number((n / 1000).toFixed(n >= 10000 ? 0 : 1))}k Hz` : `${Math.round(n)} Hz`);
const signed = (n: number, unit = '') => `${n > 0 ? '+' : ''}${n}${unit}`;

interface Row {
  label: string;
  value: string;
  keys: (keyof SynthParams)[];
}

interface Group {
  title: string;
  rows: Row[];
}

export function patchGroups(p: SynthParams): Group[] {
  const groups: Group[] = [];

  const osc: Row[] = [];
  const v1On = p.vco1Level > 0.02;
  const v2On = p.vco2Level > 0.02;
  if (v1On) {
    osc.push({ label: 'VCO 1', value: `${WAVE[p.vco1Waveform]} · ${pct(p.vco1Level)}`, keys: ['vco1Waveform', 'vco1Level'] });
    if (p.vco1Octave || p.vco1Semi || p.vco1Fine)
      osc.push({
        label: 'VCO 1 tune',
        value: [p.vco1Octave && `oct ${signed(p.vco1Octave)}`, p.vco1Semi && `${signed(p.vco1Semi)} semi`, p.vco1Fine && `${signed(p.vco1Fine)}¢`].filter(Boolean).join(' · '),
        keys: ['vco1Octave', 'vco1Semi', 'vco1Fine'],
      });
    if (p.vco1Waveform === 'square') osc.push({ label: 'Pulse width', value: pct(p.vco1PulseWidth), keys: ['vco1PulseWidth'] });
  } else {
    osc.push({ label: 'VCO 1', value: 'off', keys: ['vco1Level'] });
  }
  if (v2On) {
    osc.push({ label: 'VCO 2', value: `${WAVE[p.vco2Waveform]} · ${pct(p.vco2Level)}`, keys: ['vco2Waveform', 'vco2Level'] });
    osc.push({
      label: 'VCO 2 tune',
      value: [`oct ${signed(p.vco2Octave)}`, p.vco2Semi && `${signed(p.vco2Semi)} semi`, `${signed(p.vco2Fine)}¢`].filter(Boolean).join(' · '),
      keys: ['vco2Octave', 'vco2Semi', 'vco2Fine'],
    });
  } else {
    osc.push({ label: 'VCO 2', value: 'off', keys: ['vco2Level'] });
  }
  if (p.noiseLevel > 0.01) osc.push({ label: 'Noise', value: pct(p.noiseLevel), keys: ['noiseLevel'] });
  if (Math.abs(p.oscBalance) > 0.01) osc.push({ label: 'Balance', value: p.oscBalance < 0 ? `toward VCO 1` : `toward VCO 2`, keys: ['oscBalance'] });
  groups.push({ title: 'Sources', rows: osc });

  const filt: Row[] = [
    { label: 'Cutoff', value: hz(p.filterCutoff), keys: ['filterCutoff'] },
    { label: 'Resonance', value: p.filterResonance.toFixed(1), keys: ['filterResonance'] },
    { label: 'Env amount', value: signed(Math.round(p.filterEnvAmount), '%'), keys: ['filterEnvAmount'] },
  ];
  if (p.filterKeyTracking !== DEFAULT_SYNTH_PARAMS.filterKeyTracking) filt.push({ label: 'Key track', value: pct(p.filterKeyTracking), keys: ['filterKeyTracking'] });
  if (p.filterRolloff !== DEFAULT_SYNTH_PARAMS.filterRolloff) filt.push({ label: 'Slope', value: `${p.filterRolloff} dB`, keys: ['filterRolloff'] });
  groups.push({ title: 'Filter', rows: filt });

  groups.push({
    title: 'Amp envelope',
    rows: [
      { label: 'Attack', value: time(p.ampAttack), keys: ['ampAttack'] },
      { label: 'Decay', value: time(p.ampDecay), keys: ['ampDecay'] },
      { label: 'Sustain', value: pct(p.ampSustain), keys: ['ampSustain'] },
      { label: 'Release', value: time(p.ampRelease), keys: ['ampRelease'] },
    ],
  });

  if (Math.abs(p.filterEnvAmount) > 1) {
    groups.push({
      title: 'Filter envelope',
      rows: [
        { label: 'Attack', value: time(p.modAttack), keys: ['modAttack'] },
        { label: 'Decay', value: time(p.modDecay), keys: ['modDecay'] },
        { label: 'Sustain', value: pct(p.modSustain), keys: ['modSustain'] },
        { label: 'Release', value: time(p.modRelease), keys: ['modRelease'] },
      ],
    });
  }

  if (p.lfoDepth > 0.01) {
    groups.push({
      title: 'LFO',
      rows: [
        { label: 'Target', value: LFO_TARGET[p.lfoDestination] ?? p.lfoDestination, keys: ['lfoDestination'] },
        { label: 'Rate', value: `${Number(p.lfoRate.toFixed(p.lfoRate < 1 ? 2 : 1))} Hz`, keys: ['lfoRate'] },
        { label: 'Depth', value: pct(p.lfoDepth), keys: ['lfoDepth'] },
        { label: 'Shape', value: WAVE[p.lfoWaveform] ?? p.lfoWaveform, keys: ['lfoWaveform'] },
      ],
    });
  } else {
    groups.push({ title: 'LFO', rows: [{ label: 'LFO', value: 'off', keys: ['lfoDepth'] }] });
  }
  return groups;
}

interface PatchParamListProps {
  params: SynthParams;
  /** Highlight settings that differ from this patch (defaults to the Init patch). */
  compareTo?: SynthParams;
  className?: string;
}

export const PatchParamList: React.FC<PatchParamListProps> = ({ params, compareTo = DEFAULT_SYNTH_PARAMS, className = '' }) => {
  const groups = patchGroups(params);
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 font-mono text-[11px] ${className}`}>
      {groups.map((g) => (
        <div key={g.title} className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">{g.title}</div>
          {g.rows.map((r) => {
            const changed = r.keys.some((k) => params[k] !== compareTo[k]);
            return (
              <div key={r.label} className="flex justify-between gap-2">
                <span className="text-slate-400 shrink-0">{r.label}</span>
                <span className={`text-right truncate ${changed ? 'text-amber-200 font-bold' : 'text-slate-300'}`}>{r.value}</span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};
