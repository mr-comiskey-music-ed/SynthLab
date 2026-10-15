import { ENVELOPE_CENTER_SECONDS } from '../utils/taper';
import React, { useState } from 'react';
import { SynthParams, WaveformType, LfoDestination, FilterRolloff } from '../types';
import { Knob } from './Knob';
import { ToggleSwitch } from './ToggleSwitch';
import { Visualizer } from './Visualizer';
import { FilterVisualizer } from './FilterVisualizer';
import { AdsrVisualizer } from './AdsrVisualizer';
import { SubtractiveEngine } from '../audio/synthEngine';
import { WaveformIcon } from './WaveformIcons';

interface MinilogueViewProps {
  params: SynthParams;
  engine: SubtractiveEngine;
  onParamChange: (key: keyof SynthParams, val: any) => void;
  highlightKey?: string | null;
}

export const MinilogueView: React.FC<MinilogueViewProps> = ({
  params,
  engine,
  onParamChange,
  highlightKey,
}) => {
  const [activeEgTab, setActiveEgTab] = useState<'amp' | 'filter'>('amp');
  const isHighlighted = (k: string) => highlightKey === k;

  return (
    <div
      id="hardware-bench-chassis"
      className="relative w-full rounded-2xl overflow-hidden flex shadow-[0_25px_60px_rgba(0,0,0,0.9)] border border-slate-700"
    >
      {/* Left Wood End-Cheek */}
      <div
        className="w-4 sm:w-6 flex-shrink-0 border-r border-black/40 shadow-inner"
        style={{
          background:
            'linear-gradient(to right, #4a2810 0%, #683818 40%, #522c12 80%, #381e0c 100%)',
          boxShadow: 'inset 2px 0 6px rgba(0,0,0,0.6)',
        }}
      />

      {/* Center Sandblasted Silver Aluminum Faceplate */}
      <div
        className="flex-1 p-4 text-slate-800 font-sans"
        style={{
          background:
            'linear-gradient(180deg, #dce1e7 0%, #c8cfd8 45%, #b9c2cc 100%)',
          boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.8), inset 0 -2px 5px rgba(0,0,0,0.2)',
        }}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between border-b-2 border-slate-400/50 pb-2 mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-base sm:text-lg font-bold tracking-wider text-slate-900 uppercase font-sans flex items-center gap-2">
              <span>MODERN SYNTH</span>
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {/* Real metal screws aesthetic */}
            <div className="w-2.5 h-2.5 rounded-full bg-slate-400 border border-slate-600 flex items-center justify-center shadow-inner">
              <div className="w-1.5 h-[1px] bg-slate-700" />
            </div>
            <div className="w-2.5 h-2.5 rounded-full bg-slate-400 border border-slate-600 flex items-center justify-center shadow-inner">
              <div className="w-1.5 h-[1px] bg-slate-700 -rotate-45" />
            </div>
          </div>
        </div>

        {/* Modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-3 items-stretch">
          {/* VCO 1 & 2 */}
          <div
            id="minilogue-vco-section"
            className={`lg:col-span-4 rounded-xl p-3 border-2 transition-all ${
              isHighlighted('vco')
                ? 'border-amber-500 bg-amber-50/50 shadow-md ring-2 ring-amber-400'
                : 'border-slate-400/40 bg-white/40'
            }`}
          >
            <div className="flex items-center justify-between border-b border-slate-300 pb-1 mb-2">
              <span className="text-xs font-bold font-sans tracking-wide text-amber-800 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> VCO 1 & VCO 2
              </span>
              <span className="text-[9px] font-mono text-slate-500 uppercase">ANALOG VOICING</span>
            </div>

            {/* VCO 1 */}
            <div className="mb-3 p-2 rounded bg-black/5 border border-black/10">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-amber-900 font-mono">VCO 1</span>
                <ToggleSwitch<WaveformType>
                  id="mini-vco1-wave"
                  label=""
                  options={[
                    { label: 'Sawtooth', value: 'sawtooth', title: 'Sawtooth', icon: <WaveformIcon type="sawtooth" /> },
                    { label: 'Square', value: 'square', title: 'Square', icon: <WaveformIcon type="square" /> },
                    { label: 'Triangle', value: 'triangle', title: 'Triangle', icon: <WaveformIcon type="triangle" /> },
                    { label: 'Sine', value: 'sine', title: 'Sine', icon: <WaveformIcon type="sine" /> },
                  ]}
                  value={params.vco1Waveform}
                  theme="hardware-bench"
                  orientation="horizontal"
                  onChange={(v) => onParamChange('vco1Waveform', v)}
                />
              </div>

              <div className="flex items-center justify-around">
                <Knob
                  id="mini-vco1-oct"
                  label="Octave"
                  section="vco"
                  value={params.vco1Octave}
                  min={-2}
                  max={2}
                  step={1}
                  defaultValue={0}
                  unit="semi"
                  theme="hardware-bench"
                  onChange={(v) => onParamChange('vco1Octave', v)}
                />
                <Knob
                  id="mini-vco1-level"
                  label="Level"
                  section="vco"
                  value={params.vco1Level * 100}
                  min={0}
                  max={100}
                  step={1}
                  defaultValue={80}
                  unit="%"
                  theme="hardware-bench"
                  onChange={(v) => onParamChange('vco1Level', v / 100)}
                />
                <div className="flex flex-col items-center">
                  <Knob
                    id="mini-vco1-pw"
                    label="Shape"
                    section="vco"
                    value={params.vco1PulseWidth * 100}
                    min={0}
                    max={100}
                    step={1}
                    defaultValue={0}
                    unit="%"
                    theme="hardware-bench"
                    lfoDepth={params.lfoDepth}
                    onChange={(v) => {
                      onParamChange('vco1PulseWidth', v / 100);
                      if (params.vco1Waveform !== 'square') {
                        onParamChange('vco1Waveform', 'square');
                      }
                    }}
                  />
                  <span className={`text-[8px] font-mono font-bold tracking-tighter uppercase px-1 rounded mt-0.5 ${
                    params.vco1Waveform === 'square' ? 'text-amber-800 bg-amber-200/80' : 'text-slate-500'
                  }`}>
                    {params.vco1Waveform === 'square' ? 'PWM ACTIVE' : 'PWM (ON SQR)'}
                  </span>
                </div>
              </div>
            </div>

            {/* VCO 2 */}
            <div className="p-2 rounded bg-black/5 border border-black/10">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-amber-900 font-mono">VCO 2</span>
                <ToggleSwitch<WaveformType>
                  id="mini-vco2-wave"
                  label=""
                  options={[
                    { label: 'Sawtooth', value: 'sawtooth', title: 'Sawtooth', icon: <WaveformIcon type="sawtooth" /> },
                    { label: 'Square', value: 'square', title: 'Square', icon: <WaveformIcon type="square" /> },
                    { label: 'Triangle', value: 'triangle', title: 'Triangle', icon: <WaveformIcon type="triangle" /> },
                    { label: 'Sine', value: 'sine', title: 'Sine', icon: <WaveformIcon type="sine" /> },
                    { label: 'Noise', value: 'noise', title: 'Noise', icon: <WaveformIcon type="noise" /> },
                  ]}
                  value={params.vco2Waveform}
                  theme="hardware-bench"
                  orientation="horizontal"
                  onChange={(v) => onParamChange('vco2Waveform', v)}
                />
              </div>

              <div className="flex items-center justify-around">
                <Knob
                  id="mini-vco2-oct"
                  label="Octave"
                  section="vco"
                  value={params.vco2Octave}
                  min={-2}
                  max={2}
                  step={1}
                  defaultValue={0}
                  unit="semi"
                  theme="hardware-bench"
                  onChange={(v) => onParamChange('vco2Octave', v)}
                />
                <Knob
                  id="mini-vco2-fine"
                  label="Pitch / Detune"
                  section="vco"
                  value={params.vco2Fine}
                  min={-50}
                  max={50}
                  step={1}
                  defaultValue={0}
                  unit="cents"
                  theme="hardware-bench"
                  lfoModulated={params.lfoDestination === 'pitch' && params.lfoDepth > 0}
                  lfoDepth={params.lfoDepth}
                  onChange={(v) => onParamChange('vco2Fine', v)}
                />
                <Knob
                  id="mini-vco2-level"
                  label="Level"
                  section="vco"
                  value={params.vco2Level * 100}
                  min={0}
                  max={100}
                  step={1}
                  defaultValue={50}
                  unit="%"
                  theme="hardware-bench"
                  onChange={(v) => onParamChange('vco2Level', v / 100)}
                />
              </div>
            </div>

            {/* Mixer Controls */}
            <div className="flex items-center justify-around mt-2 pt-1 border-t border-slate-300">
              <Knob
                id="mini-noise-level"
                label="Noise"
                section="vco"
                value={params.noiseLevel * 100}
                min={0}
                max={100}
                step={1}
                defaultValue={0}
                unit="%"
                theme="hardware-bench"
                onChange={(v) => onParamChange('noiseLevel', v / 100)}
              />
              <Knob
                id="mini-osc-balance"
                label="Crossfade"
                section="vco"
                value={params.oscBalance}
                min={-1}
                max={1}
                step={0.05}
                defaultValue={0}
                theme="hardware-bench"
                onChange={(v) => onParamChange('oscBalance', v)}
              />
            </div>
          </div>

          {/* VCF Filter Section */}
          <div
            id="minilogue-vcf-section"
            className={`lg:col-span-3 rounded-xl p-2 border-2 transition-all flex flex-col justify-between ${
              isHighlighted('filter')
                ? 'border-red-500 bg-red-50/50 shadow-md ring-2 ring-red-400'
                : 'border-slate-400/40 bg-white/40'
            }`}
          >
            <div>
              <div className="flex items-center justify-between border-b border-slate-300 pb-1 mb-2">
                <span className="text-xs font-bold font-sans tracking-wide text-red-800 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500" /> VCF FILTER
                </span>
                <ToggleSwitch<FilterRolloff>
                  id="mini-filter-pole"
                  label=""
                  options={[
                    { label: '2-Pole', value: -12, short: '2-P' },
                    { label: '4-Pole', value: -24, short: '4-P' },
                  ]}
                  value={params.filterRolloff}
                  theme="hardware-bench"
                  orientation="horizontal"
                  onChange={(v) => onParamChange('filterRolloff', v)}
                />
              </div>

              {/* Big Cutoff & Resonance with red pointers */}
              <div className="flex items-center justify-around mb-2">
                <Knob
                  id="mini-filter-cutoff"
                  label="Cutoff"
                  section="filter"
                  value={params.filterCutoff}
                  min={20}
                  max={20000}
                  logarithmic
                  size="lg"
                  defaultValue={3500}
                  unit="Hz"
                  theme="hardware-bench"
                  lfoModulated={params.lfoDestination === 'cutoff' && params.lfoDepth > 0}
                  lfoDepth={params.lfoDepth}
                  onChange={(v) => onParamChange('filterCutoff', v)}
                />
                <Knob
                  id="mini-filter-resonance"
                  label="Resonance"
                  section="filter"
                  value={params.filterResonance}
                  min={0.1}
                  max={20}
                  step={0.1}
                  defaultValue={3}
                  theme="hardware-bench"
                  onChange={(v) => onParamChange('filterResonance', v)}
                />
              </div>

              <div className="flex items-center justify-around pt-1 pb-2 border-t border-slate-300">
                <Knob
                  id="mini-filter-env"
                  label="EG Int"
                  section="filter"
                  value={params.filterEnvAmount}
                  min={-100}
                  max={100}
                  step={1}
                  defaultValue={40}
                  unit="%"
                  theme="hardware-bench"
                  onChange={(v) => onParamChange('filterEnvAmount', v)}
                />
                <Knob
                  id="mini-filter-keytrack"
                  label="Key Track"
                  section="filter"
                  value={params.filterKeyTracking * 100}
                  min={0}
                  max={100}
                  step={1}
                  defaultValue={50}
                  unit="%"
                  theme="hardware-bench"
                  onChange={(v) => onParamChange('filterKeyTracking', v / 100)}
                />
              </div>

              {/* Minilogue OLED Display & Filter Visualizer */}
              <FilterVisualizer engine={engine} theme="hardware-bench" height={220} />
            </div>

            {/* Real-time Spectrometer */}
            <div className="mt-2">
              <Visualizer engine={engine} theme="hardware-bench" height={280} />
            </div>
          </div>

          {/* Envelopes Section */}
          <div
            id="minilogue-eg-section"
            className={`lg:col-span-3 rounded-xl p-3 border-2 transition-all ${
              isHighlighted('envelope')
                ? 'border-emerald-500 bg-emerald-50/50 shadow-md ring-2 ring-emerald-400'
                : 'border-slate-400/40 bg-white/40'
            }`}
          >
            <div className="flex items-center justify-between border-b border-slate-300 pb-1 mb-2">
              <span className="text-xs font-bold font-sans tracking-wide text-emerald-800 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> ENVELOPES (EG)
              </span>
              <div className="flex rounded bg-black/10 p-0.5 border border-black/15 text-[9px] font-mono">
                <button
                  type="button"
                  onClick={() => setActiveEgTab('amp')}
                  className={`px-2 py-0.5 rounded font-bold transition-colors ${
                    activeEgTab === 'amp' ? 'bg-emerald-600 text-white shadow' : 'text-slate-600 hover:text-black'
                  }`}
                >
                  Amp EG
                </button>
                <button
                  type="button"
                  onClick={() => setActiveEgTab('filter')}
                  className={`px-2 py-0.5 rounded font-bold transition-colors ${
                    activeEgTab === 'filter' ? 'bg-emerald-600 text-white shadow' : 'text-slate-600 hover:text-black'
                  }`}
                >
                  Filter EG
                </button>
              </div>
            </div>

            {/* Interactive ADSR Visualizer Diagram */}
            <div className="mb-2">
              <AdsrVisualizer
                attack={activeEgTab === 'amp' ? params.ampAttack : params.modAttack}
                decay={activeEgTab === 'amp' ? params.ampDecay : params.modDecay}
                sustain={activeEgTab === 'amp' ? params.ampSustain : params.modSustain}
                release={activeEgTab === 'amp' ? params.ampRelease : params.modRelease}
                height={95}
                theme="diagram"
                engine={engine}
              />
            </div>

            {/* AMP EG */}
            <div className="mb-3 p-2 rounded bg-black/5 border border-black/10">
              <span className="text-[10px] font-bold text-emerald-900 font-mono block mb-1">
                AMP EG (Volume Contour)
              </span>
              <div className="grid grid-cols-4 gap-1">
                <Knob
                  id="mini-amp-attack"
                  label="Attack"
                  section="envelope"
                  size="sm"
                  value={params.ampAttack}
                  min={0.001}
                  max={3.0}
                  step={0.01}
                  defaultValue={0.02}
                  unit="s"
                  theme="hardware-bench"
                  centerValue={ENVELOPE_CENTER_SECONDS}
                  onChange={(v) => onParamChange('ampAttack', v)}
                />
                <Knob
                  id="mini-amp-decay"
                  label="Decay"
                  section="envelope"
                  size="sm"
                  value={params.ampDecay}
                  min={0.01}
                  max={3.0}
                  step={0.01}
                  defaultValue={0.4}
                  unit="s"
                  theme="hardware-bench"
                  centerValue={ENVELOPE_CENTER_SECONDS}
                  onChange={(v) => onParamChange('ampDecay', v)}
                />
                <Knob
                  id="mini-amp-sustain"
                  label="Sustain"
                  section="envelope"
                  size="sm"
                  value={Math.round(params.ampSustain * 100)}
                  min={0}
                  max={100}
                  step={1}
                  defaultValue={60}
                  unit="%"
                  theme="hardware-bench"
                  onChange={(v) => onParamChange('ampSustain', v / 100)}
                />
                <Knob
                  id="mini-amp-release"
                  label="Release"
                  section="envelope"
                  size="sm"
                  value={params.ampRelease}
                  min={0.01}
                  max={4.0}
                  step={0.01}
                  defaultValue={0.3}
                  unit="s"
                  theme="hardware-bench"
                  centerValue={ENVELOPE_CENTER_SECONDS}
                  onChange={(v) => onParamChange('ampRelease', v)}
                />
              </div>
            </div>

            {/* MOD / FILTER EG */}
            <div className="p-2 rounded bg-black/5 border border-black/10">
              <span className="text-[10px] font-bold text-emerald-900 font-mono block mb-1">
                MOD / FILTER EG
              </span>
              <div className="grid grid-cols-4 gap-1">
                <Knob
                  id="mini-mod-attack"
                  label="Attack"
                  section="envelope"
                  size="sm"
                  value={params.modAttack}
                  min={0.001}
                  max={3.0}
                  step={0.01}
                  defaultValue={0.03}
                  unit="s"
                  theme="hardware-bench"
                  centerValue={ENVELOPE_CENTER_SECONDS}
                  onChange={(v) => onParamChange('modAttack', v)}
                />
                <Knob
                  id="mini-mod-decay"
                  label="Decay"
                  section="envelope"
                  size="sm"
                  value={params.modDecay}
                  min={0.01}
                  max={3.0}
                  step={0.01}
                  defaultValue={0.5}
                  unit="s"
                  theme="hardware-bench"
                  centerValue={ENVELOPE_CENTER_SECONDS}
                  onChange={(v) => onParamChange('modDecay', v)}
                />
                <Knob
                  id="mini-mod-sustain"
                  label="Sustain"
                  section="envelope"
                  size="sm"
                  value={Math.round(params.modSustain * 100)}
                  min={0}
                  max={100}
                  step={1}
                  defaultValue={20}
                  unit="%"
                  theme="hardware-bench"
                  onChange={(v) => onParamChange('modSustain', v / 100)}
                />
                <Knob
                  id="mini-mod-release"
                  label="Release"
                  section="envelope"
                  size="sm"
                  value={params.modRelease}
                  min={0.01}
                  max={4.0}
                  step={0.01}
                  defaultValue={0.4}
                  unit="s"
                  theme="hardware-bench"
                  centerValue={ENVELOPE_CENTER_SECONDS}
                  onChange={(v) => onParamChange('modRelease', v)}
                />
              </div>
            </div>
          </div>

          {/* LFO & Master Section */}
          <div
            id="minilogue-lfo-section"
            className={`lg:col-span-2 rounded-xl p-3 border-2 transition-all flex flex-col justify-between ${
              isHighlighted('lfo')
                ? 'border-cyan-500 bg-cyan-50/50 shadow-md ring-2 ring-cyan-400'
                : 'border-slate-400/40 bg-white/40'
            }`}
          >
            <div>
              <div className="flex items-center justify-between border-b border-slate-300 pb-1 mb-2">
                <span className="text-xs font-bold font-sans tracking-wide text-cyan-800 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-cyan-500" /> LFO
                </span>
              </div>

              {/* LFO Controls */}
              <div className="p-2 rounded bg-black/5 border border-black/10 mb-3">
                <div className="flex items-center justify-end mb-2">
                  <ToggleSwitch<any>
                    id="mini-lfo-wave"
                    label=""
                    options={[
                      { label: 'Sine', value: 'sine', title: 'Sine', icon: <WaveformIcon type="sine" /> },
                      { label: 'Triangle', value: 'triangle', title: 'Triangle', icon: <WaveformIcon type="triangle" /> },
                      { label: 'Sawtooth', value: 'sawtooth', title: 'Sawtooth', icon: <WaveformIcon type="sawtooth" /> },
                      { label: 'Square', value: 'square', title: 'Square', icon: <WaveformIcon type="square" /> },
                    ]}
                    value={params.lfoWaveform}
                    theme="hardware-bench"
                    orientation="horizontal"
                    onChange={(v) => onParamChange('lfoWaveform', v)}
                  />
                </div>

                <div className="flex items-center justify-around mb-2">
                  <Knob
                    id="mini-lfo-rate"
                    label="Rate"
                    section="lfo"
                    value={params.lfoRate}
                    min={0.1}
                    max={20}
                    step={0.1}
                    defaultValue={4}
                    unit="Hz"
                    theme="hardware-bench"
                    onChange={(v) => onParamChange('lfoRate', v)}
                  />
                  <Knob
                    id="mini-lfo-depth"
                    label="Int"
                    section="lfo"
                    value={params.lfoDepth * 100}
                    min={0}
                    max={100}
                    step={1}
                    defaultValue={5}
                    unit="%"
                    theme="hardware-bench"
                    onChange={(v) => onParamChange('lfoDepth', v / 100)}
                  />
                </div>

                <div className="pt-2 border-t border-slate-300">
                  <ToggleSwitch<LfoDestination>
                    id="mini-lfo-dest"
                    label="TARGET"
                    options={[
                      { label: 'Pitch', value: 'pitch', short: 'PITCH' },
                      { label: 'Cutoff', value: 'cutoff', short: 'CUTOFF' },
                    ]}
                    value={params.lfoDestination}
                    theme="hardware-bench"
                    orientation="horizontal"
                    onChange={(v) => onParamChange('lfoDestination', v)}
                  />
                </div>
              </div>
            </div>

            {/* Master Volume */}
            <div className="p-2 rounded bg-black/10 border border-slate-400 flex flex-col items-center">
              <span className="text-[10px] font-bold text-slate-800 font-mono mb-1 uppercase tracking-wider">
                Master Vol
              </span>
              <Knob
                id="mini-master-volume"
                label="Level"
                section="master"
                value={params.masterVolume * 100}
                min={0}
                max={100}
                step={1}
                defaultValue={75}
                unit="%"
                size="lg"
                theme="hardware-bench"
                onChange={(v) => onParamChange('masterVolume', v / 100)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Right Wood End-Cheek */}
      <div
        className="w-4 sm:w-6 flex-shrink-0 border-l border-black/40 shadow-inner"
        style={{
          background:
            'linear-gradient(to left, #4a2810 0%, #683818 40%, #522c12 80%, #381e0c 100%)',
          boxShadow: 'inset -2px 0 6px rgba(0,0,0,0.6)',
        }}
      />
    </div>
  );
};
