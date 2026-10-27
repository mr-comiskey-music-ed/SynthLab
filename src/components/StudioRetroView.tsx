import { ENVELOPE_CENTER_SECONDS } from '../utils/taper';
import React, { useState } from 'react';
import { SynthParams, WaveformType, LfoDestination, FilterRolloff, VoiceMode } from '../types';
import { Knob } from './Knob';
import { balanceText } from '../utils/balanceText';
import { VerticalSlider } from './Slider';
import { ToggleSwitch } from './ToggleSwitch';
import { Visualizer } from './Visualizer';
import { FilterVisualizer } from './FilterVisualizer';
import { AdsrVisualizer } from './AdsrVisualizer';
import { LfoPitchBadge } from './LfoPitchBadge';
import { SubtractiveEngine, lfoCutoffHz, lfoPwmDuty } from '../audio/synthEngine';
import { WaveformIcon } from './WaveformIcons';

interface StudioRetroViewProps {
  params: SynthParams;
  engine: SubtractiveEngine;
  onParamChange: (key: keyof SynthParams, val: any) => void;
  highlightKey?: string | null;
}

export const StudioRetroView: React.FC<StudioRetroViewProps> = ({
  params,
  engine,
  onParamChange,
  highlightKey,
}) => {
  const [activeEgTab, setActiveEgTab] = useState<'amp' | 'filter'>('amp');
  const isHighlighted = (k: string) => highlightKey === k;

  return (
    <div
      id="studio-retro-chassis"
      className="relative w-full rounded-2xl bg-[#121419] text-slate-100 p-4 border-t border-b border-[#2d3442] border-l-[12px] border-r-[12px] border-[#421d0d] shadow-[0_25px_60px_rgba(0,0,0,0.9)] font-sans"
      style={{
        backgroundImage:
          'radial-gradient(ellipse at 50% 0%, rgba(255, 255, 255, 0.05) 0%, transparent 70%), linear-gradient(to bottom, #161920 0%, #0d0f14 100%)',
      }}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between border-b-2 border-blue-600/40 pb-2.5 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-red-600 shadow-[0_0_10px_#dc2626] animate-pulse" />
          <h2 className="text-sm font-mono tracking-widest text-slate-200 uppercase font-bold flex items-center gap-2">
            <span>RETRO SYNTH</span>
          </h2>
        </div>
      </div>

      {/* Main Signal Flow Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-3 items-stretch">
        {/* Module 1: VCO 1 & 2 (Oscillator Section) */}
        <div
          id="module-oscillators"
          className={`lg:col-span-4 rounded-xl p-3 border transition-all ${
            isHighlighted('vco')
              ? 'ring-2 ring-amber-400 border-amber-400 bg-amber-500/10'
              : 'bg-[#181c24]/90 border-amber-500/30'
          }`}
        >
          <div className="flex items-center justify-between border-b border-amber-500/30 pb-1.5 mb-3">
            <span className="text-xs font-mono font-bold text-amber-300 tracking-wider flex items-center gap-2">
              1. DUAL OSCILLATORS (VCO)
              <LfoPitchBadge params={params} />
            </span>
            <span className="text-[9px] font-mono text-amber-400/80 uppercase">PITCH & TONE</span>
          </div>

          {/* VCO 1 */}
          <div className="mb-3 p-2 rounded-lg bg-black/30 border border-amber-500/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono text-amber-300 font-bold">VCO 1</span>
              <ToggleSwitch<WaveformType>
                id="retro-vco1-wave"
                label=""
                options={[
                  { label: 'Sawtooth', value: 'sawtooth', title: 'Sawtooth', icon: <WaveformIcon type="sawtooth" /> },
                  { label: 'Square', value: 'square', title: 'Square', icon: <WaveformIcon type="square" /> },
                  { label: 'Triangle', value: 'triangle', title: 'Triangle', icon: <WaveformIcon type="triangle" /> },
                  { label: 'Sine', value: 'sine', title: 'Sine', icon: <WaveformIcon type="sine" /> },
                ]}
                value={params.vco1Waveform}
                theme="studio-retro"
                orientation="horizontal"
                onChange={(val) => onParamChange('vco1Waveform', val)}
              />
            </div>
            <div className="flex items-center justify-around">
              <Knob
                id="retro-vco1-oct"
                label="Octave"
                value={params.vco1Octave}
                min={-2}
                max={2}
                step={1}
                defaultValue={0}
                theme="studio-retro"
                section="vco"
                onChange={(v) => onParamChange('vco1Octave', v)}
              />
              <Knob
                id="retro-vco1-level"
                label="Level"
                value={params.vco1Level * 100}
                min={0}
                max={100}
                step={1}
                defaultValue={80}
                unit="%"
                theme="studio-retro"
                section="vco"
                onChange={(v) => onParamChange('vco1Level', v / 100)}
              />
              <div className="flex flex-col items-center">
                <Knob
                  id="retro-vco1-pw"
                  label="Pulse Width"
                  value={params.vco1PulseWidth * 100}
                  min={5}
                  max={95}
                  step={1}
                  defaultValue={50}
                  unit="%"
                  theme="studio-retro"
                  section="vco"
                  lfoSwing={params.lfoDestination === 'pwm' && params.lfoDepth > 0 && params.vco1Waveform === 'square' ? { amount: lfoPwmDuty(params.lfoDepth) * 100, rate: params.lfoRate, waveform: params.lfoWaveform } : undefined}
                  onChange={(v) => {
                    onParamChange('vco1PulseWidth', v / 100);
                    if (params.vco1Waveform !== 'square') {
                      onParamChange('vco1Waveform', 'square');
                    }
                  }}
                />
                <span className={`text-[8px] font-mono font-bold tracking-tighter uppercase px-1 rounded mt-0.5 ${
                  params.vco1Waveform === 'square' ? 'text-amber-400 bg-amber-500/20' : 'text-slate-500'
                }`}>
                  {params.vco1Waveform !== 'square' ? 'SQUARE ONLY' : Math.abs(params.vco1PulseWidth - 0.5) < 0.03 ? '50/50 SQUARE' : 'THIN PULSE'}
                </span>
              </div>
            </div>
          </div>

          {/* VCO 2 */}
          <div className="p-2 rounded-lg bg-black/30 border border-amber-500/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono text-amber-300 font-bold">VCO 2</span>
              <ToggleSwitch<WaveformType>
                id="retro-vco2-wave"
                label=""
                options={[
                  { label: 'Sawtooth', value: 'sawtooth', title: 'Sawtooth', icon: <WaveformIcon type="sawtooth" /> },
                  { label: 'Square', value: 'square', title: 'Square', icon: <WaveformIcon type="square" /> },
                  { label: 'Triangle', value: 'triangle', title: 'Triangle', icon: <WaveformIcon type="triangle" /> },
                  { label: 'Sine', value: 'sine', title: 'Sine', icon: <WaveformIcon type="sine" /> },
                  { label: 'Noise', value: 'noise', title: 'Noise', icon: <WaveformIcon type="noise" /> },
                ]}
                value={params.vco2Waveform}
                theme="studio-retro"
                orientation="horizontal"
                onChange={(val) => onParamChange('vco2Waveform', val)}
              />
            </div>
            <div className="flex items-center justify-around">
              <Knob
                id="retro-vco2-oct"
                label="Octave"
                value={params.vco2Octave}
                min={-2}
                max={2}
                step={1}
                defaultValue={0}
                theme="studio-retro"
                section="vco"
                onChange={(v) => onParamChange('vco2Octave', v)}
              />
              <Knob
                id="retro-vco2-fine"
                label="Fine Detune"
                value={params.vco2Fine}
                min={-50}
                max={50}
                step={1}
                defaultValue={0}
                unit="cents"
                theme="studio-retro"
                section="vco"
                onChange={(v) => onParamChange('vco2Fine', v)}
              />
              <Knob
                id="retro-vco2-level"
                label="Level"
                value={params.vco2Level * 100}
                min={0}
                max={100}
                step={1}
                defaultValue={50}
                unit="%"
                theme="studio-retro"
                section="vco"
                onChange={(v) => onParamChange('vco2Level', v / 100)}
              />
            </div>
          </div>

          {/* Noise & Balance */}
          <div className="flex items-center justify-around mt-2 pt-2 border-t border-amber-500/10">
            <Knob
              id="retro-noise-level"
              label="White Noise"
              value={params.noiseLevel * 100}
              min={0}
              max={100}
              step={1}
              defaultValue={0}
              unit="%"
              theme="studio-retro"
              section="vco"
              onChange={(v) => onParamChange('noiseLevel', v / 100)}
            />
            <Knob
              id="retro-osc-balance"
              label="VCO Crossfade"
              format={balanceText}
              value={params.oscBalance}
              min={-1}
              max={1}
              step={0.05}
              defaultValue={0}
              theme="studio-retro"
              section="vco"
              onChange={(v) => onParamChange('oscBalance', v)}
            />
          </div>
        </div>

        {/* Module 2: VCF Filter Section */}
        <div
          id="module-filter"
          className={`lg:col-span-3 rounded-xl p-2 border transition-all flex flex-col justify-start ${
            isHighlighted('filter')
              ? 'ring-2 ring-red-400 border-red-400 bg-red-500/10'
              : 'bg-[#181c24]/90 border-red-500/30'
          }`}
        >
          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex items-center justify-between border-b border-red-500/30 pb-1.5 mb-2">
              <span className="text-xs font-mono font-bold text-red-400 tracking-wider">
                2. LOW-PASS FILTER (VCF)
              </span>
              <ToggleSwitch<FilterRolloff>
                id="retro-filter-slope"
                label=""
                options={[
                  { label: '2-Pole', value: -12, short: '12dB' },
                  { label: '4-Pole', value: -24, short: '24dB' },
                ]}
                value={params.filterRolloff}
                theme="studio-retro"
                orientation="horizontal"
                onChange={(v) => onParamChange('filterRolloff', v)}
              />
            </div>

            {/* All four filter knobs in one row (wraps to two rows when the panel is narrow) */}
            <div className="flex flex-wrap items-center justify-around gap-x-1 gap-y-1 mb-2">
              <Knob
                id="retro-filter-cutoff"
                label="Cutoff (Hz)"
                value={params.filterCutoff}
                min={20}
                max={20000}
                logarithmic
                size="lg"
                defaultValue={3500}
                unit="Hz"
                theme="studio-retro"
                section="filter"
                lfoSwing={params.lfoDestination === 'cutoff' && params.lfoDepth > 0 ? { amount: lfoCutoffHz(params.lfoDepth), rate: params.lfoRate, waveform: params.lfoWaveform } : undefined}
                onChange={(v) => onParamChange('filterCutoff', v)}
              />
              <Knob
                id="retro-filter-resonance"
                label="Resonance (Q)"
                value={params.filterResonance}
                min={0.1}
                max={20}
                step={0.1}
                defaultValue={3}
                theme="studio-retro"
                section="filter"
                onChange={(v) => onParamChange('filterResonance', v)}
              />

              {/* Env Amount & Key Tracking: same row as the big knobs, wrapping on narrow screens */}
              <Knob
                id="retro-filter-env"
                label="EG Depth"
                value={params.filterEnvAmount}
                min={-100}
                max={100}
                step={1}
                defaultValue={40}
                unit="%"
                theme="studio-retro"
                section="filter"
                onChange={(v) => onParamChange('filterEnvAmount', v)}
              />
              <Knob
                id="retro-filter-keytrack"
                label="Key Track"
                value={params.filterKeyTracking * 100}
                min={0}
                max={100}
                step={1}
                defaultValue={50}
                unit="%"
                theme="studio-retro"
                section="filter"
                onChange={(v) => onParamChange('filterKeyTracking', v / 100)}
              />
            </div>

            {/* Integrated Filter Response */}
            <div className="flex-1 min-h-[125px]">
              <FilterVisualizer engine={engine} theme="studio-retro" height={125} fill />
            </div>
          </div>

          {/* Real-time Spectrometer */}
          <div className="mt-1.5 flex-1 min-h-[150px]">
            <Visualizer engine={engine} theme="studio-retro" height={150} fill />
          </div>
        </div>

        {/* Module 3: Envelopes (Amp ADSR & Mod ADSR) */}
        <div
          id="module-envelopes"
          className={`lg:col-span-3 rounded-xl p-3 border transition-all ${
            isHighlighted('envelope')
              ? 'ring-2 ring-emerald-400 border-emerald-400 bg-emerald-500/10'
              : 'bg-[#181c24]/90 border-emerald-500/30'
          }`}
        >
          <div className="flex items-center justify-between border-b border-emerald-500/30 pb-1.5 mb-2">
            <span className="text-xs font-mono font-bold text-emerald-400 tracking-wider">
              3. ENVELOPES (ADSR)
            </span>
            <div className="flex rounded bg-black/60 p-0.5 border border-emerald-500/20 text-[9px] font-mono">
              <button
                type="button"
                onClick={() => setActiveEgTab('amp')}
                className={`px-2 py-0.5 rounded font-bold transition-colors ${
                  activeEgTab === 'amp' ? 'bg-emerald-500 text-black shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Amp EG
              </button>
              <button
                type="button"
                onClick={() => setActiveEgTab('filter')}
                className={`px-2 py-0.5 rounded font-bold transition-colors ${
                  activeEgTab === 'filter' ? 'bg-emerald-500 text-black shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Filter EG
              </button>
            </div>
          </div>

          {/* Interactive ADSR Curve Visualizer modeled on curriculum diagram */}
          <div className="mb-2">
            <AdsrVisualizer
              attack={activeEgTab === 'amp' ? params.ampAttack : params.modAttack}
              decay={activeEgTab === 'amp' ? params.ampDecay : params.modDecay}
              sustain={activeEgTab === 'amp' ? params.ampSustain : params.modSustain}
              release={activeEgTab === 'amp' ? params.ampRelease : params.modRelease}
              height={100}
              theme="studio-retro"
              engine={engine}
            />
          </div>

          {/* Amp Envelope Sliders */}
          <div className="mb-3">
            <span className="text-[10px] font-mono text-emerald-300 font-bold block mb-1">
              AMP EG (Volume Contour)
            </span>
            <div className="grid grid-cols-4 gap-1 bg-black/30 p-2 rounded-lg border border-emerald-500/10">
              <VerticalSlider
                id="retro-amp-attack"
                label="A"
                value={params.ampAttack}
                min={0.001}
                max={3.0}
                step={0.01}
                defaultValue={0.02}
                unit="s"
                theme="studio-retro"
                section="envelope"
                height={80}
                centerValue={ENVELOPE_CENTER_SECONDS}
                onChange={(v) => onParamChange('ampAttack', v)}
              />
              <VerticalSlider
                id="retro-amp-decay"
                label="D"
                value={params.ampDecay}
                min={0.01}
                max={3.0}
                step={0.01}
                defaultValue={0.4}
                unit="s"
                theme="studio-retro"
                section="envelope"
                height={80}
                centerValue={ENVELOPE_CENTER_SECONDS}
                onChange={(v) => onParamChange('ampDecay', v)}
              />
              <VerticalSlider
                id="retro-amp-sustain"
                label="S"
                value={params.ampSustain}
                min={0}
                max={1.0}
                step={0.01}
                defaultValue={0.6}
                unit="%"
                theme="studio-retro"
                section="envelope"
                height={80}
                onChange={(v) => onParamChange('ampSustain', v)}
              />
              <VerticalSlider
                id="retro-amp-release"
                label="R"
                value={params.ampRelease}
                min={0.01}
                max={4.0}
                step={0.01}
                defaultValue={0.3}
                unit="s"
                theme="studio-retro"
                section="envelope"
                height={80}
                centerValue={ENVELOPE_CENTER_SECONDS}
                onChange={(v) => onParamChange('ampRelease', v)}
              />
            </div>
          </div>

          {/* Filter Mod Envelope */}
          <div>
            <span className="text-[10px] font-mono text-emerald-300 font-bold block mb-1">
              MOD / FILTER EG
            </span>
            <div className="grid grid-cols-4 gap-1 bg-black/30 p-2 rounded-lg border border-emerald-500/10">
              <VerticalSlider
                id="retro-mod-attack"
                label="A"
                value={params.modAttack}
                min={0.001}
                max={3.0}
                step={0.01}
                defaultValue={0.03}
                unit="s"
                theme="studio-retro"
                section="envelope"
                height={75}
                centerValue={ENVELOPE_CENTER_SECONDS}
                onChange={(v) => onParamChange('modAttack', v)}
              />
              <VerticalSlider
                id="retro-mod-decay"
                label="D"
                value={params.modDecay}
                min={0.01}
                max={3.0}
                step={0.01}
                defaultValue={0.5}
                unit="s"
                theme="studio-retro"
                section="envelope"
                height={75}
                centerValue={ENVELOPE_CENTER_SECONDS}
                onChange={(v) => onParamChange('modDecay', v)}
              />
              <VerticalSlider
                id="retro-mod-sustain"
                label="S"
                value={params.modSustain}
                min={0}
                max={1.0}
                step={0.01}
                defaultValue={0.2}
                unit="%"
                theme="studio-retro"
                section="envelope"
                height={75}
                onChange={(v) => onParamChange('modSustain', v)}
              />
              <VerticalSlider
                id="retro-mod-release"
                label="R"
                value={params.modRelease}
                min={0.01}
                max={4.0}
                step={0.01}
                defaultValue={0.4}
                unit="s"
                theme="studio-retro"
                section="envelope"
                height={75}
                centerValue={ENVELOPE_CENTER_SECONDS}
                onChange={(v) => onParamChange('modRelease', v)}
              />
            </div>
          </div>
        </div>

        {/* Module 4: LFO & Master Output */}
        <div
          id="module-lfo-master"
          className={`lg:col-span-2 rounded-xl p-3 border transition-all flex flex-col justify-between ${
            isHighlighted('lfo')
              ? 'ring-2 ring-blue-400 border-blue-400 bg-blue-500/10'
              : 'bg-[#181c24]/90 border-blue-500/30'
          }`}
        >
          <div>
            <div className="flex items-center justify-between border-b border-blue-500/30 pb-1.5 mb-2">
              <span className="text-xs font-mono font-bold text-blue-400 tracking-wider">
                4. LFO & MASTER
              </span>
            </div>

            {/* LFO Controls */}
            <div className="p-2 rounded-lg bg-black/30 border border-blue-500/10 mb-3">
              <div className="flex items-center justify-end mb-2">
                <ToggleSwitch<any>
                  id="retro-lfo-wave"
                  label=""
                  options={[
                    { label: 'Sine', value: 'sine', title: 'Sine', icon: <WaveformIcon type="sine" /> },
                    { label: 'Triangle', value: 'triangle', title: 'Triangle', icon: <WaveformIcon type="triangle" /> },
                    { label: 'Sawtooth', value: 'sawtooth', title: 'Sawtooth', icon: <WaveformIcon type="sawtooth" /> },
                    { label: 'Square', value: 'square', title: 'Square', icon: <WaveformIcon type="square" /> },
                  ]}
                  value={params.lfoWaveform}
                  theme="studio-retro"
                  orientation="horizontal"
                  onChange={(v) => onParamChange('lfoWaveform', v)}
                />
              </div>

              <div className="flex items-center justify-around mb-2">
                <Knob
                  id="retro-lfo-rate"
                  label="Rate"
                  value={params.lfoRate}
                  min={0.1}
                  max={20}
                  step={0.1}
                  defaultValue={4}
                  unit="Hz"
                  theme="studio-retro"
                  section="lfo"
                  onChange={(v) => onParamChange('lfoRate', v)}
                />
                <Knob
                  id="retro-lfo-depth"
                  label="Depth"
                  value={params.lfoDepth * 100}
                  min={0}
                  max={100}
                  step={1}
                  defaultValue={5}
                  unit="%"
                  theme="studio-retro"
                  section="lfo"
                  onChange={(v) => onParamChange('lfoDepth', v / 100)}
                />
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-blue-500/10">
                <span className="text-[9px] font-mono text-slate-400 uppercase">Target:</span>
                <ToggleSwitch<LfoDestination>
                  id="retro-lfo-dest"
                  label=""
                  options={[
                    { label: 'Pitch', value: 'pitch', short: 'PITCH' },
                    { label: 'Filter', value: 'cutoff', short: 'CUTOFF' },
                    { label: 'Pulse Width', value: 'pwm', short: 'PW' },
                  ]}
                  value={params.lfoDestination}
                  theme="studio-retro"
                  orientation="horizontal"
                  onChange={(v) => onParamChange('lfoDestination', v)}
                />
              </div>
            </div>
          </div>

          {/* Master Output Section */}
          <div className="p-2 rounded-lg bg-black/40 border border-slate-600/40 flex flex-col items-center">
            {/* Voicing: poly (chords) or mono (one note, with glide) */}
            <div className="flex flex-col items-center gap-1 mb-2 pb-2 border-b border-slate-600/40">
              <ToggleSwitch<VoiceMode>
                id="retro-voice-mode"
                label="Voices"
                options={[
                  { label: 'Poly: play chords', value: 'poly', short: 'POLY' },
                  { label: 'Mono: one note at a time, with glide', value: 'mono', short: 'MONO' },
                ]}
                value={params.voiceMode}
                theme="studio-retro"
                orientation="horizontal"
                onChange={(v) => onParamChange('voiceMode', v)}
              />
              <Knob
                id="retro-glide"
                label="Glide"
                section="master"
                value={Math.round(params.glide * 1000)}
                min={0}
                max={1000}
                step={10}
                defaultValue={0}
                unit="ms"
                theme="studio-retro"
                onChange={(v) => {
                  onParamChange('glide', v / 1000);
                  if (v > 0 && params.voiceMode !== 'mono') onParamChange('voiceMode', 'mono');
                }}
              />
              <span className="text-[8px] font-mono font-bold uppercase text-slate-500">{params.voiceMode === 'mono' ? 'GLIDE ON' : 'MONO ONLY'}</span>
            </div>
            <span className="text-[10px] font-mono text-slate-300 font-bold mb-1 uppercase tracking-wider">
              Master Volume
            </span>
            <Knob
              id="retro-master-volume"
              label="Level"
              value={params.masterVolume * 100}
              min={0}
              max={100}
              step={1}
              defaultValue={75}
              unit="%"
              size="lg"
              theme="studio-retro"
              section="master"
              onChange={(v) => onParamChange('masterVolume', v / 100)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
