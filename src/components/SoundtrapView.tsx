import React, { useRef, useState } from 'react';
import {
  SoundtrapPatch,
  SLIDERS,
  SliderKey,
  SYNC_DIVS,
  GUIDE_BASE,
  StSection,
  sliderPos,
  sliderValue,
  formatValue,
} from '../utils/soundtrap';

/**
 * A playable copy of Soundtrap's synth panel (Juno-106 layout), for the Soundtrap Synth Guide.
 * It looks like Soundtrap's light panel, with a thin SynthLab section color under each title
 * (amber oscillator, red filter, green envelope/amp, blue LFO) as a bridge between the two.
 */

const PINK = '#d6337a';
const SECTION_COLOR: Record<StSection, string> = {
  lfo: '#3b82f6',
  osc: '#f59e0b',
  hpf: '#ef4444',
  filter: '#ef4444',
  amp: '#10b981',
  env: '#10b981',
  chorus: '#94a3b8',
  glide: '#94a3b8',
};
const SECTION_TITLE: Record<StSection, string> = {
  lfo: 'LFO',
  osc: 'OSCILLATORS',
  hpf: 'HPF',
  filter: 'FILTER',
  amp: 'AMP',
  env: 'ENVELOPE',
  chorus: 'CHORUS',
  glide: 'GLIDE',
};

const TRACK_H = 128;
const CAP_H = 12;

/** One vertical fader. Touch that starts on the track moves it and never scrolls the page. */
const Fader: React.FC<{
  label: string;
  pos: number;
  readout: string;
  onPos: (pos: number) => void;
  onReset?: () => void;
  disabled?: boolean;
  title?: string;
}> = ({ label, pos, readout, onPos, onReset, disabled, title }) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState(false);

  const fromY = (clientY: number) => {
    const r = trackRef.current?.getBoundingClientRect();
    if (!r) return;
    onPos(1 - (clientY - r.top - CAP_H / 2) / (r.height - CAP_H));
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    setDrag(true);
    fromY(e.clientY);
    const move = (ev: MouseEvent) => fromY(ev.clientY);
    const up = () => {
      setDrag(false);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (disabled || e.touches.length !== 1) return;
    setDrag(true);
    fromY(e.touches[0].clientY);
    const move = (ev: TouchEvent) => {
      if (ev.touches.length !== 1) return;
      if (ev.cancelable) ev.preventDefault();
      fromY(ev.touches[0].clientY);
    };
    const end = () => {
      setDrag(false);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', end);
      window.removeEventListener('touchcancel', end);
    };
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', end);
    window.addEventListener('touchcancel', end);
  };

  const p = Math.max(0, Math.min(1, pos));
  const capBottom = p * (TRACK_H - CAP_H);
  return (
    <div className={`flex flex-col items-center w-[46px] shrink-0 select-none ${disabled ? 'opacity-35' : ''}`} title={title}>
      <span className="h-7 flex items-end justify-center text-center text-[10.5px] leading-[1.1] font-medium uppercase text-[#3f3f46]">{label}</span>
      <div
        ref={trackRef}
        className={`relative w-9 mt-1 touch-none ${disabled ? 'cursor-not-allowed' : 'cursor-ns-resize'}`}
        style={{ height: TRACK_H }}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        onDoubleClick={disabled ? undefined : onReset}
        role="slider"
        aria-label={label}
        aria-valuetext={readout}
        aria-valuenow={Math.round(p * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-disabled={disabled}
      >
        {/* track */}
        <div className="absolute left-1/2 -translate-x-1/2 w-[3px] rounded bg-[#c4c4ca]" style={{ top: CAP_H / 2, bottom: CAP_H / 2 }} />
        {/* fill: pink from the bottom up to the cap */}
        <div
          className="absolute left-1/2 -translate-x-1/2 w-[3px] rounded"
          style={{ bottom: CAP_H / 2, height: capBottom, background: PINK }}
        />
        {/* cap */}
        <div
          className={`absolute left-1/2 -translate-x-1/2 w-8 rounded-[3px] bg-white border border-[#52525b] shadow-[0_1px_2px_rgba(0,0,0,0.35)] flex flex-col justify-center gap-[2px] px-[3px] ${
            drag ? 'ring-2 ring-[#d6337a]/50' : ''
          }`}
          style={{ bottom: capBottom, height: CAP_H }}
        >
          <i className="block h-px bg-[#52525b]" />
          <i className="block h-px bg-[#52525b]" />
        </div>
      </div>
      <span className="mt-1 text-[10px] font-mono tabular-nums text-[#52525b] whitespace-nowrap">{readout}</span>
    </div>
  );
};

/** A square panel button with an LED above it. */
const LedButton: React.FC<{ on: boolean; onClick: () => void; label?: React.ReactNode; aria: string; title?: string }> = ({
  on,
  onClick,
  label,
  aria,
  title,
}) => (
  <div className="flex flex-col items-center gap-1 shrink-0" title={title}>
    {label !== undefined && <span className="h-5 flex items-end text-[11px] font-medium text-[#3f3f46]">{label}</span>}
    <span
      className={`w-2.5 h-2.5 rounded-full border ${on ? 'bg-[#ff4040] border-[#ff8080] shadow-[0_0_6px_2px_rgba(255,64,64,0.6)]' : 'bg-[#7f1d1d] border-[#991b1b] opacity-60'}`}
      aria-hidden="true"
    />
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={aria}
      className={`w-9 h-9 rounded-[3px] border border-[#52525b] transition-colors ${on ? 'bg-[#d4d4d8] shadow-inner' : 'bg-white hover:bg-[#f4f4f5] shadow-[0_1px_2px_rgba(0,0,0,0.25)]'}`}
    />
  </div>
);

/** A vertical switch: a pill with a black dot, and one label per position. */
function Switch<T extends string>({ value, options, onChange, aria }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void; aria: string }) {
  const idx = Math.max(0, options.findIndex((o) => o.v === value));
  const n = options.length;
  const rowH = 28;
  return (
    <div className="flex items-center gap-1.5 shrink-0" role="radiogroup" aria-label={aria}>
      <button
        type="button"
        onClick={() => onChange(options[(idx + 1) % n].v)}
        className="relative w-[26px] rounded-full bg-white border border-[#71717a] shadow-inner"
        style={{ height: rowH * n }}
        aria-label={`${aria}: ${options[idx].label} (click to change)`}
      >
        <span
          className="absolute left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-[#18181b] shadow transition-all"
          style={{ top: idx * rowH + (rowH - 20) / 2 }}
        />
      </button>
      <div className="flex flex-col">
        {options.map((o) => (
          <button
            key={o.v}
            type="button"
            role="radio"
            aria-checked={o.v === value}
            onClick={() => onChange(o.v)}
            className={`text-left text-[15px] font-medium leading-none flex items-center ${o.v === value ? 'text-[#18181b]' : 'text-[#52525b] hover:text-[#18181b]'}`}
            style={{ height: rowH }}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const WaveGlyph: React.FC<{ kind: 'square' | 'saw' }> = ({ kind }) => (
  <svg viewBox="0 0 22 16" className="w-[22px] h-4" aria-hidden="true">
    <path
      d={kind === 'square' ? 'M2 14 V2 H8 V14 H14 V2 H20 V14' : 'M2 14 L20 2 V14'}
      fill="none"
      stroke="#3f3f46"
      strokeWidth={1.6}
      strokeLinejoin="miter"
    />
  </svg>
);

/** One titled panel section. Defined outside the panel so its sliders are never remounted mid-drag. */
const Section: React.FC<{ id: StSection; lit: boolean; children: React.ReactNode }> = ({ id, lit, children }) => (
  <div
    className={`flex flex-col rounded-[4px] bg-[#f4f4f5] border transition-shadow ${
      lit ? 'border-amber-400 shadow-[0_0_0_3px_rgba(251,191,36,0.75),0_0_18px_rgba(251,191,36,0.55)]' : 'border-[#a1a1aa]'
    }`}
    data-section={id}
  >
    <div className="px-2 pt-1 pb-0.5 bg-white rounded-t-[4px] border-b border-[#a1a1aa] text-center">
      <span className="text-[17px] font-semibold tracking-wide text-[#18181b]">{SECTION_TITLE[id]}</span>
      <div className="h-[3px] rounded-full mt-0.5" style={{ background: SECTION_COLOR[id] }} aria-hidden="true" />
    </div>
    <div className="flex items-end gap-1.5 px-2 pt-2 pb-3 flex-1">{children}</div>
  </div>
);

interface SoundtrapViewProps {
  patch: SoundtrapPatch;
  onChange: (next: Partial<SoundtrapPatch>) => void;
  /** Sections to glow (the guide step's topic). */
  highlight?: StSection[];
}

export const SoundtrapView: React.FC<SoundtrapViewProps> = ({ patch, onChange, highlight = [] }) => {
  const fader = (key: SliderKey, opts: { label?: string; disabled?: boolean; title?: string } = {}) => {
    const spec = SLIDERS[key];
    return (
      <Fader
        key={key}
        label={opts.label ?? spec.label}
        pos={sliderPos(spec, patch[key])}
        readout={formatValue(spec, patch[key])}
        onPos={(pos) => onChange({ [key]: sliderValue(spec, pos) } as Partial<SoundtrapPatch>)}
        onReset={() => onChange({ [key]: GUIDE_BASE[key] } as Partial<SoundtrapPatch>)}
        disabled={opts.disabled}
        title={opts.title}
      />
    );
  };

  // LFO Rate: Hz, or note values when Sync is on.
  const rateFader = patch.lfoSync ? (
    <Fader
      label="Rate"
      pos={patch.lfoSyncDiv / (SYNC_DIVS.length - 1)}
      readout={SYNC_DIVS[patch.lfoSyncDiv]?.label ?? ''}
      onPos={(pos) => onChange({ lfoSyncDiv: Math.round(Math.max(0, Math.min(1, pos)) * (SYNC_DIVS.length - 1)) })}
      onReset={() => onChange({ lfoSyncDiv: GUIDE_BASE.lfoSyncDiv })}
      title="Synced to the song's tempo (120 BPM here)"
    />
  ) : (
    fader('lfoRate')
  );

  return (
    <div className="rounded-xl bg-[#d4d4d8] p-3 shadow-2xl" style={{ fontFamily: "'Barlow', system-ui, sans-serif" }}>
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-[#52525b]">Soundtrap synth · practice copy</span>
        <span className="text-[10px] font-mono text-[#71717a]">Drag a slider · double-click to reset it</span>
      </div>
      <div className="overflow-x-auto pb-1">
        <div className="flex flex-wrap items-stretch justify-center gap-1.5">
          <Section id="lfo" lit={highlight.includes('lfo')}>
            <div className="flex flex-col items-center gap-2 self-stretch justify-between pb-1">
              <LedButton on={patch.lfoSync} onClick={() => onChange({ lfoSync: !patch.lfoSync })} label="SYNC" aria="LFO Sync" title="Lock the LFO rate to the song's tempo" />
              <Switch
                aria="LFO wave"
                value={patch.lfoWave}
                options={[
                  { v: 'sine', label: 'SIN' },
                  { v: 'sawtooth', label: 'SAW' },
                  { v: 'triangle', label: 'TRI' },
                ]}
                onChange={(v) => onChange({ lfoWave: v })}
              />
            </div>
            {rateFader}
            {fader('lfoDelay')}
          </Section>

          <Section id="osc" lit={highlight.includes('osc')}>
            {fader('oscLfo', { title: 'Vibrato: how much the LFO moves the pitch' })}
            {fader('pwm', { title: 'Pulse width of the Square wave' })}
            <div className="self-center pb-6">
              <Switch
                aria="PWM source"
                value={patch.pwmMode}
                options={[
                  { v: 'lfo', label: 'LFO' },
                  { v: 'man', label: 'MAN' },
                ]}
                onChange={(v) => onChange({ pwmMode: v })}
              />
            </div>
            <div className="flex gap-1.5 self-center pb-6">
              <LedButton on={patch.square} onClick={() => onChange({ square: !patch.square })} label={<WaveGlyph kind="square" />} aria="Square wave" title="Square (pulse) wave: shaped by PWM" />
              <LedButton on={patch.saw} onClick={() => onChange({ saw: !patch.saw })} label={<WaveGlyph kind="saw" />} aria="Saw wave" title="Saw wave" />
              <LedButton on={patch.sub} onClick={() => onChange({ sub: !patch.sub })} label={<WaveGlyph kind="square" />} aria="Sub-oscillator" title="Sub-Osc: a square wave one octave lower" />
            </div>
            {fader('subLevel', { disabled: !patch.sub, title: patch.sub ? 'Sub-Osc level' : 'Turn on the Sub-Osc button (third wave button) to use this' })}
            {fader('noise')}
          </Section>

          <Section id="hpf" lit={highlight.includes('hpf')}>{fader('hpf', { title: 'High-pass filter: cuts the lows below this' })}</Section>

          <Section id="filter" lit={highlight.includes('filter')}>
            {fader('cutoff', { title: 'Cutoff' })}
            {fader('res', { title: 'Resonance' })}
            <div className="self-center pb-6">
              <Switch
                aria="Filter envelope direction"
                value={patch.envPolarity}
                options={[
                  { v: 'reg', label: 'REG' },
                  { v: 'inv', label: 'INV' },
                ]}
                onChange={(v) => onChange({ envPolarity: v })}
              />
            </div>
            {fader('env', { title: 'How far the envelope moves the cutoff (EG Amount)' })}
            {fader('filterLfo', { title: 'Wobble: how much the LFO moves the cutoff' })}
            {fader('kybd', { title: 'Keyboard tracking: higher notes open the filter more' })}
          </Section>

          <Section id="amp" lit={highlight.includes('amp')}>
            <div className="self-center pb-6">
              <Switch
                aria="Amp mode"
                value={patch.ampMode}
                options={[
                  { v: 'env', label: 'ENV' },
                  { v: 'bypass', label: 'BYPASS' },
                ]}
                onChange={(v) => onChange({ ampMode: v })}
              />
            </div>
            {fader('gain')}
          </Section>

          <Section id="env" lit={highlight.includes('env')}>
            {fader('attack', { title: 'Attack' })}
            {fader('decay', { title: 'Decay' })}
            {fader('sustain', { title: 'Sustain' })}
            {fader('release', { title: 'Release' })}
          </Section>

          <Section id="chorus" lit={highlight.includes('chorus')}>
            <div className="flex gap-1.5 self-center pb-6">
              <LedButton on={patch.chorus1} onClick={() => onChange({ chorus1: !patch.chorus1 })} label="I" aria="Chorus I" />
              <LedButton on={patch.chorus2} onClick={() => onChange({ chorus2: !patch.chorus2 })} label="II" aria="Chorus II" />
            </div>
          </Section>

          <Section id="glide" lit={highlight.includes('glide')}>
            <div className="self-center pb-6 flex flex-col items-center">
              <span className="text-[11px] font-medium text-[#3f3f46] text-center leading-tight mb-1">
                MONOPHONIC
                <br />
                ON/OFF
              </span>
              <LedButton on={patch.mono} onClick={() => onChange({ mono: !patch.mono })} aria="Monophonic on/off" />
            </div>
            {fader('glide', { disabled: !patch.mono, title: patch.mono ? 'How long each note slides to the next' : 'Turn on Monophonic to use Glide' })}
          </Section>
        </div>
      </div>
    </div>
  );
};
