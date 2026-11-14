import React, { useRef, useState } from 'react';
import { ShrinkToFit } from './ShrinkToFit';
import { LfoShape } from '../audio/synthEngine';
import { SYNC_DIVS } from '../utils/guides';
import { RetroPatch, RetroKey, RSPECS, RETRO_BASE, RsSection, rPos, rValue, rFormat, cutoffHz } from '../utils/retroSynth';

/**
 * A playable copy of Logic Pro's Retro Synth (ANALOG engine), for the Retro Synth Guide.
 * Dark panel, silver knobs and orange screens like Logic's, with a thin SynthLab section color under
 * each title (amber oscillator, red filter, green amp and envelopes, blue LFO) as a bridge between the two.
 */

const ORANGE = '#ff9d2e';
const SECTION_COLOR: Record<RsSection, string> = {
  osc: '#f59e0b',
  filter: '#ef4444',
  amp: '#10b981',
  effect: '#94a3b8',
  glide: '#94a3b8',
  lfo: '#3b82f6',
  filterEnv: '#10b981',
  ampEnv: '#10b981',
};

type Change = (next: Partial<RetroPatch>) => void;

/** Mouse or touch drag. Touch that starts here never scrolls the page. */
function startDrag(e: React.MouseEvent | React.TouchEvent, onMove: (x: number, y: number, x0: number, y0: number) => void) {
  const touch = 'touches' in e;
  if (touch && e.touches.length !== 1) return;
  if (!touch) e.preventDefault();
  const p0 = touch ? e.touches[0] : e;
  const x0 = p0.clientX;
  const y0 = p0.clientY;
  if (touch) {
    const move = (ev: TouchEvent) => {
      if (ev.touches.length !== 1) return;
      if (ev.cancelable) ev.preventDefault();
      onMove(ev.touches[0].clientX, ev.touches[0].clientY, x0, y0);
    };
    const end = () => {
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', end);
      window.removeEventListener('touchcancel', end);
    };
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', end);
    window.addEventListener('touchcancel', end);
  } else {
    const move = (ev: MouseEvent) => onMove(ev.clientX, ev.clientY, x0, y0);
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }
}

/** Drag up or down to change a value (relative), like Logic's knobs and screen numbers. */
function useValueDrag(k: RetroKey, value: number, onChange: Change, pxPerRange = 180) {
  const spec = RSPECS[k];
  return (e: React.MouseEvent | React.TouchEvent) => {
    const p0 = rPos(spec, value);
    startDrag(e, (_x, y, _x0, y0) => onChange({ [k]: rValue(spec, p0 + (y0 - y) / pxPerRange) } as Partial<RetroPatch>));
  };
}

const reset = (k: RetroKey, onChange: Change) => () => onChange({ [k]: RETRO_BASE[k] } as Partial<RetroPatch>);

/** Little wave pictures, for the Shape knobs and the LFO wave buttons. */
const GLYPH: Record<string, string> = {
  noise: 'M1 8 L3 3 L4 11 L6 5 L7 12 L9 2 L10 9 L12 4 L13 10 L15 6',
  saw: 'M1 12 L15 3 V12',
  rampDown: 'M1 3 L15 12 V3',
  triangle: 'M1 12 L5 3 L9 12 L13 3 L15 7.5',
  square: 'M1 12 V3 H8 V12 H15 V3',
  pulse: 'M1 12 V3 H3.5 V12 H15 V3',
  random: 'M1 9 H4 V4 H7 V11 H10 V6 H13 V8 H15',
  sine: 'M1 7.5 C3 1, 6 1, 8 7.5 S13 14, 15 7.5',
};
const Glyph: React.FC<{ d: string; color?: string; w?: number }> = ({ d, color = '#a1a1aa', w = 16 }) => (
  <svg viewBox="0 0 16 15" width={w} height={(w * 15) / 16} aria-hidden="true">
    <path d={GLYPH[d]} fill="none" stroke={color} strokeWidth={1.4} strokeLinejoin="round" strokeLinecap="round" />
  </svg>
);

const ANG = 135;
const polar = (cx: number, cy: number, r: number, t: number) => {
  const a = ((-ANG + 2 * ANG * t - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
};
const arcPath = (cx: number, cy: number, r: number, t0: number, t1: number) => {
  const a = polar(cx, cy, r, Math.min(t0, t1));
  const b = polar(cx, cy, r, Math.max(t0, t1));
  const large = Math.abs(t1 - t0) * 2 * ANG > 180 ? 1 : 0;
  return `M${a.x} ${a.y} A${r} ${r} 0 ${large} 1 ${b.x} ${b.y}`;
};

/** A silver knob. Drag up/down to turn; double-click to reset. */
const Knob: React.FC<{
  k: RetroKey;
  patch: RetroPatch;
  onChange: Change;
  label?: string;
  size?: number;
  /** Wave pictures around the dial, at these travel positions. */
  marks?: { t: number; glyph: string }[];
  /** Words under the dial's two ends. */
  ends?: [string, string];
  title?: string;
  bold?: boolean;
}> = ({ k, patch, onChange, label, size = 52, marks, ends, title, bold }) => {
  const spec = RSPECS[k];
  const v = patch[k] as number;
  const t = rPos(spec, v);
  const drag = useValueDrag(k, v, onChange);
  const bipolar = spec.min < 0;
  const pad = marks ? 18 : 6;
  const W = size + pad * 2;
  const c = W / 2;
  const r = size / 2;
  const tip = polar(c, c, r * 0.62, t);
  const base = polar(c, c, r * 0.2, t);
  return (
    <div className="flex flex-col items-center shrink-0 select-none" title={title}>
      <span className={`text-[13px] leading-tight text-center whitespace-nowrap ${bold ? 'font-semibold text-[#e4e4e7] text-[15px]' : 'text-[#c4c4c8]'}`}>{label ?? spec.label}</span>
      <svg
        width={W}
        height={W}
        className="touch-none cursor-ns-resize"
        onMouseDown={drag}
        onTouchStart={drag}
        onDoubleClick={reset(k, onChange)}
        role="slider"
        aria-label={label ?? spec.label}
        aria-valuetext={rFormat(spec, v)}
        aria-valuenow={Math.round(t * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <defs>
          <radialGradient id={`kg-${k}`} cx="40%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#fafafa" />
            <stop offset="55%" stopColor="#b8b8bc" />
            <stop offset="100%" stopColor="#6b6b70" />
          </radialGradient>
        </defs>
        {/* tick ring */}
        {Array.from({ length: 11 }, (_, i) => {
          const a = polar(c, c, r + 2, i / 10);
          const b = polar(c, c, r + 5, i / 10);
          return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#52525b" strokeWidth={1.2} />;
        })}
        <path d={arcPath(c, c, r + 1, bipolar ? 0.5 : 0, t)} fill="none" stroke={ORANGE} strokeWidth={2.5} strokeLinecap="round" opacity={0.85} />
        <circle cx={c} cy={c} r={r * 0.92} fill="#18181b" />
        <circle cx={c} cy={c} r={r * 0.72} fill={`url(#kg-${k})`} stroke="#3f3f46" strokeWidth={1} />
        <line x1={base.x} y1={base.y} x2={tip.x} y2={tip.y} stroke="#18181b" strokeWidth={2.2} strokeLinecap="round" />
        {marks?.map((m, i) => {
          const p = polar(c, c, r + 11, m.t);
          return (
            <g key={i} transform={`translate(${p.x - 6} ${p.y - 5.5})`}>
              <svg viewBox="0 0 16 15" width={12} height={11}>
                <path d={GLYPH[m.glyph]} fill="none" stroke="#a1a1aa" strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
              </svg>
            </g>
          );
        })}
      </svg>
      {ends && (
        <span className="flex justify-between w-full px-1 -mt-2 text-[10px] text-[#8b8b90]">
          <span>{ends[0]}</span>
          <span>{ends[1]}</span>
        </span>
      )}
      <span className="mt-0.5 text-[11px] font-mono tabular-nums text-[#ffb057] whitespace-nowrap [.rs-mini_&]:text-[15px] [.rs-mini_&]:font-bold">
        {rFormat(spec, v)}
      </span>
    </div>
  );
};

/** A vertical slider with a blue cap (Mix, Key, LFO amounts, Vel). Click or drag anywhere on the track. */
const VSlider: React.FC<{
  k: RetroKey;
  patch: RetroPatch;
  onChange: Change;
  h?: number;
  /** Mix runs top = Osc 1. */
  invert?: boolean;
  label?: string;
  showValue?: boolean;
  disabled?: boolean;
  title?: string;
}> = ({ k, patch, onChange, h = 110, invert, label, showValue = true, disabled, title }) => {
  const spec = RSPECS[k];
  const v = patch[k] as number;
  const t = rPos(spec, v);
  const up = invert ? 1 - t : t;
  const ref = useRef<HTMLDivElement | null>(null);
  const CAP = 22;
  const setFromY = (y: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const u = 1 - (y - r.top - CAP / 2) / (r.height - CAP);
    onChange({ [k]: rValue(spec, invert ? 1 - u : u) } as Partial<RetroPatch>);
  };
  const down = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    const p = 'touches' in e ? e.touches[0] : e;
    setFromY(p.clientY);
    startDrag(e, (_x, y) => setFromY(y));
  };
  return (
    <div className={`flex flex-col items-center shrink-0 select-none ${disabled ? 'opacity-40' : ''}`} title={title}>
      {label && <span className="text-[12px] text-[#c4c4c8] mb-1">{label}</span>}
      <div
        ref={ref}
        className={`relative w-7 touch-none ${disabled ? 'cursor-not-allowed' : 'cursor-ns-resize'}`}
        style={{ height: h }}
        onMouseDown={down}
        onTouchStart={down}
        onDoubleClick={disabled ? undefined : reset(k, onChange)}
        role="slider"
        aria-label={label ?? spec.label}
        aria-valuetext={rFormat(spec, v)}
        aria-valuenow={Math.round(t * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="absolute left-1/2 -translate-x-1/2 w-[6px] rounded-full bg-[#0c0c0e] border border-[#3f3f46]" style={{ top: CAP / 2, bottom: CAP / 2 }} />
        <div
          className="absolute left-1/2 -translate-x-1/2 rounded-full border border-[#1e3a8a] shadow-[0_1px_3px_rgba(0,0,0,0.6)]"
          style={{ bottom: up * (h - CAP), width: CAP, height: CAP, background: 'radial-gradient(circle at 40% 35%, #dbeafe, #7aa2d8 55%, #3b5b8c)' }}
        />
      </div>
      {showValue && <span className="mt-1 text-[11px] font-mono tabular-nums text-[#ffb057] whitespace-nowrap [.rs-mini_&]:text-[15px] [.rs-mini_&]:font-bold">{rFormat(spec, v)}</span>}
    </div>
  );
};

/** An orange number in a screen: drag up/down to change it, double-click to reset. */
const ScreenField: React.FC<{ k: RetroKey; patch: RetroPatch; onChange: Change; label: string; title?: string }> = ({ k, patch, onChange, label, title }) => {
  const v = patch[k] as number;
  const drag = useValueDrag(k, v, onChange, 160);
  return (
    <span
      className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-[#2a1d0c]/80 touch-none cursor-ns-resize select-none"
      onMouseDown={drag}
      onTouchStart={drag}
      onDoubleClick={reset(k, onChange)}
      role="slider"
      aria-label={label}
      aria-valuetext={rFormat(RSPECS[k], v)}
      title={title ?? 'Drag up or down · double-click to reset'}
    >
      <span className="text-[13px]" style={{ color: ORANGE }}>
        {label}:
      </span>
      <span className="text-[14px] font-mono tabular-nums font-semibold [.rs-mini_&]:text-[17px]" style={{ color: ORANGE }}>
        {rFormat(RSPECS[k], v)}
      </span>
    </span>
  );
};

const Screen: React.FC<{ children: React.ReactNode; className?: string; dim?: boolean }> = ({ children, className = '', dim }) => (
  <div className={`relative rounded-[3px] bg-[#140e06] border border-[#3a2a14] shadow-[inset_0_2px_8px_rgba(0,0,0,0.8)] ${dim ? 'opacity-40' : ''} ${className}`}>{children}</div>
);

const PowerButton: React.FC<{ on: boolean; onClick: () => void; aria: string }> = ({ on, onClick, aria }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={on}
    aria-label={aria}
    className={`w-9 h-8 rounded-[4px] border flex items-center justify-center ${on ? 'bg-[#3a2a12] border-[#7a5320]' : 'bg-[#232326] border-[#3f3f46]'}`}
  >
    <svg viewBox="0 0 20 20" width={18} height={18} aria-hidden="true">
      <path d="M6.5 5.5 A6 6 0 1 0 13.5 5.5" fill="none" stroke={on ? ORANGE : '#71717a'} strokeWidth={2} strokeLinecap="round" />
      <line x1="10" y1="2.5" x2="10" y2="9" stroke={on ? ORANGE : '#71717a'} strokeWidth={2} strokeLinecap="round" />
    </svg>
  </button>
);

function Menu<T extends string>({ value, options, onChange, aria, dim }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void; aria: string; dim?: boolean }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      aria-label={aria}
      className={`h-8 px-2 rounded-[4px] bg-[#232326] border border-[#3f3f46] text-[15px] text-[#e4e4e7] text-center cursor-pointer ${dim ? 'opacity-50' : ''}`}
    >
      {options.map((o) => (
        <option key={o.v} value={o.v}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** One titled panel section, with the title under its controls like Retro Synth's. */
const Section: React.FC<{ id: RsSection; title: string; lit: boolean; children: React.ReactNode; className?: string; titleTop?: boolean }> = ({
  id,
  title,
  lit,
  children,
  className = '',
  titleTop,
}) => {
  const heading = (
    <div className="text-center">
      <span className={`tracking-[0.12em] text-[#a1a1aa] ${titleTop ? 'text-[19px]' : 'text-[26px] leading-none'}`}>{title}</span>
      <div className="h-[3px] w-16 mx-auto rounded-full mt-1" style={{ background: SECTION_COLOR[id] }} aria-hidden="true" />
    </div>
  );
  return (
    <div
      className={`flex flex-col gap-2 rounded-[4px] p-2.5 bg-[#2b2b2e] border transition-shadow ${
        lit ? 'border-amber-400 shadow-[0_0_0_3px_rgba(251,191,36,0.75),0_0_18px_rgba(251,191,36,0.55)]' : 'border-[#1c1c1f]'
      } ${className}`}
      data-section={id}
    >
      {titleTop && heading}
      <div className="flex-1 flex flex-col">{children}</div>
      {!titleTop && heading}
    </div>
  );
};

/** The filter's response, drawn from Cutoff, Res and type. */
const FilterCurve: React.FC<{ p: RetroPatch }> = ({ p }) => {
  const W = 300;
  const H = 120;
  const x = (hz: number) => (Math.log(hz / 20) / Math.log(1000)) * W;
  const fc = cutoffHz(p.cutoff);
  const steps = 80;
  const slope = p.filterType === 'lp24' ? 24 : 12;
  const q = 0.7 + Math.pow(p.res, 1.6) * 17;
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const hz = 20 * Math.pow(1000, i / steps);
    const ratio = p.filterType === 'hp' ? fc / hz : hz / fc;
    // A simple drawing: flat, a resonant bump at the cutoff, then the slope.
    const bump = (Math.min(q, 12) - 0.7) * 2.2 * Math.exp(-Math.pow(Math.log2(ratio) * 2.2, 2));
    const fall = ratio > 1 ? slope * Math.log2(ratio) : 0;
    const db = bump - fall;
    const y = 34 - db * 1.1;
    pts.push(`${(i / steps) * W},${Math.max(4, Math.min(H + 20, y))}`);
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={pts.join(' ')} fill="none" stroke={ORANGE} strokeWidth={1.6} />
      <circle cx={x(fc)} cy={34} r={3.5} fill={ORANGE} />
    </svg>
  );
};

/** An ADSR drawing with its four numbers, like Retro Synth's envelope screens. */
const EnvScreen: React.FC<{ p: RetroPatch; onChange: Change; keys: [RetroKey, RetroKey, RetroKey, RetroKey] }> = ({ p, onChange, keys }) => {
  const [ka, kd, ks, kr] = keys;
  const tx = (ms: number) => Math.cbrt(Math.max(0, ms) / 10000) * 90;
  const a = tx(p[ka] as number);
  const d = tx(p[kd] as number);
  const s = p[ks] as number;
  const r = tx(p[kr] as number);
  const top = 8;
  const bottom = 92;
  const sy = bottom - s * (bottom - top);
  const x1 = 6 + a;
  const x2 = x1 + d;
  const x3 = Math.max(x2 + 30, 200);
  const x4 = Math.min(x3 + r, 296);
  return (
    <Screen className="w-[300px] h-[150px] p-1.5 flex flex-col justify-between">
      <div className="flex justify-between">
        <ScreenField k={ka} patch={p} onChange={onChange} label="A" />
        <ScreenField k={kd} patch={p} onChange={onChange} label="D" />
      </div>
      <svg viewBox="0 0 300 100" className="absolute inset-x-1.5 top-8 bottom-8 w-[calc(100%-12px)] h-[calc(100%-64px)] pointer-events-none" preserveAspectRatio="none" aria-hidden="true">
        <polyline points={`6,${bottom} ${x1},${top} ${x2},${sy} ${x3},${sy} ${x4},${bottom}`} fill="none" stroke={ORANGE} strokeWidth={1.6} />
        {[
          [x1, top],
          [x2, sy],
          [x3, sy],
          [x4, bottom],
        ].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r={3} fill={ORANGE} />
        ))}
      </svg>
      <div className="flex justify-between">
        <ScreenField k={ks} patch={p} onChange={onChange} label="S" />
        <ScreenField k={kr} patch={p} onChange={onChange} label="R" />
      </div>
    </Screen>
  );
};

const WAVES: { v: LfoShape; glyph: string; label: string }[] = [
  { v: 'rampDown', glyph: 'rampDown', label: 'Falling ramp' },
  { v: 'rampUp', glyph: 'saw', label: 'Rising ramp' },
  { v: 'triangle', glyph: 'triangle', label: 'Triangle' },
  { v: 'square', glyph: 'square', label: 'Square' },
  { v: 'random', glyph: 'random', label: 'Random steps' },
];
const WAVE_DRAW: Record<LfoShape, string> = {
  rampDown: 'M10 15 L150 85 V15 L290 85',
  rampUp: 'M10 85 L150 15 V85 L290 15',
  triangle: 'M10 70 L80 15 L220 85 L290 30',
  square: 'M10 15 H80 V85 H150 V15 H220 V85 H290',
  random: 'M10 50 H60 V20 H110 V75 H160 V35 H210 V65 H260 V40 H290',
  sine: 'M10 50 C50 0, 110 0, 150 50 S250 100, 290 50',
};

/** One LFO tab: wave buttons, a picture of the wave, a Rate bar, Sync and the amount slider. */
const LfoPanel: React.FC<{ p: RetroPatch; onChange: Change; which: 'lfo' | 'vib' }> = ({ p, onChange, which }) => {
  const wave = which === 'lfo' ? p.lfoWave : p.vibWave;
  const sync = which === 'lfo' ? p.lfoSync : p.vibSync;
  const rateKey: RetroKey = which === 'lfo' ? (sync ? 'lfoSyncDiv' : 'lfoRate') : sync ? 'vibSyncDiv' : 'vibRate';
  const spec = RSPECS[rateKey];
  const rv = p[rateKey] as number;
  const t = rPos(spec, rv);
  const barRef = useRef<HTMLDivElement | null>(null);
  const setFromX = (x: number) => {
    const r = barRef.current?.getBoundingClientRect();
    if (!r) return;
    const u = (x - r.left) / r.width;
    const val = sync ? Math.round(Math.max(0, Math.min(1, u)) * (SYNC_DIVS.length - 1)) : rValue(spec, u);
    onChange({ [rateKey]: val } as Partial<RetroPatch>);
  };
  const down = (e: React.MouseEvent | React.TouchEvent) => {
    const pt = 'touches' in e ? e.touches[0] : e;
    setFromX(pt.clientX);
    startDrag(e, (x) => setFromX(x));
  };
  const readout = sync ? SYNC_DIVS[Math.round(rv)]?.label ?? '' : rFormat(spec, rv);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 items-stretch">
        <Screen className="w-[300px] h-[150px] p-1.5 flex flex-col gap-1">
          <div className="flex gap-1" role="radiogroup" aria-label={`${which === 'lfo' ? 'LFO' : 'Vibrato'} wave`}>
            {WAVES.map((w) => (
              <button
                key={w.v}
                type="button"
                role="radio"
                aria-checked={wave === w.v}
                aria-label={w.label}
                title={w.label}
                onClick={() => onChange(which === 'lfo' ? { lfoWave: w.v } : { vibWave: w.v })}
                className={`flex-1 h-6 rounded-[2px] border flex items-center justify-center ${wave === w.v ? 'border-[#ffb057] bg-[#3a2610]' : 'border-[#4a3518] bg-[#20160a]'}`}
              >
                <Glyph d={w.glyph} color={wave === w.v ? '#ffb057' : '#a07034'} />
              </button>
            ))}
          </div>
          <svg viewBox="0 0 300 100" className="flex-1 w-full" preserveAspectRatio="none" aria-hidden="true">
            <path d={WAVE_DRAW[wave]} fill="none" stroke={ORANGE} strokeWidth={1.6} />
          </svg>
          <div className="flex items-center gap-2">
            <span className="text-[13px]" style={{ color: ORANGE }}>
              Rate:
            </span>
            <div
              ref={barRef}
              className="relative flex-1 h-4 rounded-full bg-[#2a1d0c] touch-none cursor-ew-resize"
              onMouseDown={down}
              onTouchStart={down}
              role="slider"
              aria-label={`${which === 'lfo' ? 'LFO' : 'Vibrato'} rate`}
              aria-valuetext={readout}
              aria-valuenow={Math.round(t * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full" style={{ left: `calc(${t * 100}% - 7px)`, background: ORANGE }} />
            </div>
            <span className="w-14 text-right text-[14px] font-mono tabular-nums font-semibold [.rs-mini_&]:text-[17px]" style={{ color: ORANGE }}>
              {readout}
            </span>
          </div>
        </Screen>
        <VSlider
          k={which === 'lfo' ? 'lfoAmount' : 'vibAmount'}
          patch={p}
          onChange={onChange}
          h={130}
          title={which === 'lfo' ? 'How strong the LFO is overall' : 'How strong the vibrato LFO is overall'}
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[14px] text-[#c4c4c8]">Sync</span>
        <button
          type="button"
          onClick={() => onChange(which === 'lfo' ? { lfoSync: !p.lfoSync } : { vibSync: !p.vibSync })}
          aria-pressed={sync}
          aria-label={`${which === 'lfo' ? 'LFO' : 'Vibrato'} sync`}
          className="relative w-12 h-6 rounded-full bg-[#0c0c0e] border border-[#3f3f46]"
        >
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-gradient-to-b from-[#f4f4f5] to-[#9ca3af] transition-all ${sync ? 'left-[26px]' : 'left-0.5'}`} />
        </button>
        <span className="text-[12px] text-[#8b8b90]">{sync ? 'On (tempo)' : 'Off (Hz)'}</span>
      </div>
    </div>
  );
};

interface RetroViewProps {
  patch: RetroPatch;
  onChange: Change;
  /** Sections to glow (the guide step's topic). */
  highlight?: string[];
  /** A small, read-only copy (for the Settings to try): both LFO tabs show side by side. */
  mini?: boolean;
}

export const RetroView: React.FC<RetroViewProps> = ({ patch: p, onChange, highlight = [], mini = false }) => {
  const [tab, setTab] = useState<'lfo' | 'vib'>('lfo');
  const lit = (s: RsSection) => highlight.includes(s);
  const tabs = (
    <div className="flex">
      {(['lfo', 'vib'] as const).map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => setTab(t)}
          aria-pressed={tab === t}
          className={`px-4 py-1 text-[19px] tracking-[0.12em] rounded-t-[4px] ${tab === t ? 'bg-[#2b2b2e] text-[#d4d4d8]' : 'bg-[#1f1f22] text-[#6b6b70] hover:text-[#a1a1aa]'}`}
        >
          {t === 'lfo' ? 'LFO' : 'VIBRATO'}
        </button>
      ))}
    </div>
  );

  return (
    <div
      className={mini ? 'rs-mini rounded-lg bg-[#1d1d20] p-2 w-max' : 'rounded-xl bg-[#1d1d20] p-3 shadow-2xl border-x-[6px] border-[#5a3a22]'}
      style={{ fontFamily: "'Barlow', system-ui, sans-serif" }}
      inert={mini}
    >
      {!mini && (
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-[#a1a1aa]">Retro Synth · practice copy</span>
          <span className="text-[10px] font-mono text-[#8b8b90]">Drag a knob or number up or down · double-click to reset it</span>
        </div>
      )}
      <div className={mini ? '' : 'overflow-x-auto pb-1'}>
        <div className={`flex flex-col gap-1.5 ${mini ? 'w-max' : 'min-w-max mx-auto w-max'}`}>
          {/* Top row: Oscillator, Filter, Amp, Effect */}
          <div className="flex gap-1.5 items-stretch">
            <Section id="osc" title="OSCILLATOR" lit={lit('osc')}>
              <div className="flex gap-1 mb-2" aria-label="Synth engine">
                {['ANALOG', 'SYNC', 'TABLE', 'FM'].map((e) => (
                  <span
                    key={e}
                    className={`flex-1 text-center py-1 rounded-[3px] text-[17px] tracking-wide ${e === 'ANALOG' ? 'bg-[#3a2a12] text-[#ff9d2e]' : 'bg-[#232326] text-[#5f5f64]'}`}
                    title={e === 'ANALOG' ? 'The analog engine: what this guide covers' : 'A different kind of synth in Retro Synth (not covered here)'}
                  >
                    {e}
                  </span>
                ))}
              </div>
              <div className="flex gap-3 items-start">
                <div className="flex flex-col gap-1">
                  <Knob
                    k="shape1"
                    patch={p}
                    onChange={onChange}
                    size={58}
                    bold
                    marks={[
                      { t: 0.1, glyph: 'noise' },
                      { t: 0.3, glyph: 'saw' },
                      { t: 0.47, glyph: 'square' },
                      { t: 0.95, glyph: 'pulse' },
                    ]}
                    title="Osc 1: Noise → Saw → Square, then a thinner and thinner pulse"
                  />
                  <Knob
                    k="shape2"
                    patch={p}
                    onChange={onChange}
                    size={58}
                    bold
                    marks={[
                      { t: 0.1, glyph: 'triangle' },
                      { t: 0.3, glyph: 'saw' },
                      { t: 0.47, glyph: 'square' },
                      { t: 0.95, glyph: 'pulse' },
                    ]}
                    title="Osc 2: Triangle → Saw → Square, then a thinner and thinner pulse"
                  />
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-3 pt-1">
                  <Knob k="shapeMod" patch={p} onChange={onChange} ends={['LFO', 'Filter Env']} title="Moves the shape: left = the LFO, right = the filter envelope, middle = off" />
                  <Knob k="vibrato" patch={p} onChange={onChange} title="Vibrato depth: how much the VIBRATO LFO moves the pitch" />
                  <Knob k="semitones" patch={p} onChange={onChange} title="Osc 2 tuning in semitones" />
                  <Knob k="cents" patch={p} onChange={onChange} title="Osc 2 fine tuning" />
                </div>
                <div className="flex flex-col items-center pt-1">
                  <span className="text-[15px] font-semibold text-[#e4e4e7]">Mix</span>
                  <span className="text-[12px] text-[#c4c4c8]">Osc 1</span>
                  <VSlider k="mix" patch={p} onChange={onChange} invert h={150} showValue={false} title="Top: only Osc 1 · bottom: only Osc 2" />
                  <span className="text-[12px] text-[#c4c4c8]">Osc 2</span>
                  <span className="mt-0.5 text-[11px] font-mono tabular-nums text-[#ffb057] whitespace-nowrap [.rs-mini_&]:text-[15px] [.rs-mini_&]:font-bold">{rFormat(RSPECS.mix, p.mix)}</span>
                </div>
              </div>
            </Section>

            <Section id="filter" title="FILTER" lit={lit('filter')}>
              <div className="flex gap-1.5 mb-2">
                <PowerButton on={p.filterOn} onClick={() => onChange({ filterOn: !p.filterOn })} aria="Filter on/off" />
                <div className="flex-1 flex">
                  <Menu
                    aria="Filter type"
                    value={p.filterType}
                    dim={!p.filterOn}
                    onChange={(v) => onChange({ filterType: v })}
                    options={[
                      { v: 'lp24', label: 'LP 24dB' },
                      { v: 'lp12', label: 'LP 12dB' },
                      { v: 'hp', label: 'HP 12dB' },
                    ]}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Screen className="w-[300px] h-[150px] p-1.5 flex flex-col" dim={!p.filterOn}>
                  <div className="flex-1 min-h-0">
                    <FilterCurve p={p} />
                  </div>
                  <div className="flex justify-between">
                    <ScreenField k="cutoff" patch={p} onChange={onChange} label="Cutoff" />
                    <ScreenField k="res" patch={p} onChange={onChange} label="Res" />
                  </div>
                </Screen>
                <VSlider k="key" patch={p} onChange={onChange} h={130} label="Key" title="Keyboard tracking: higher notes open the filter more" />
              </div>
              <div className="flex justify-around mt-2">
                <Knob k="filterLfo" patch={p} onChange={onChange} title="Wobble: how much the LFO moves the cutoff" />
                <Knob k="filterEnv" patch={p} onChange={onChange} title="EG Amount: right pushes the cutoff up, left pushes it down, middle is off" />
              </div>
            </Section>

            <Section id="amp" title="AMP" lit={lit('amp')}>
              <div className="flex flex-col items-center gap-4 pt-2">
                <Knob k="volume" patch={p} onChange={onChange} size={56} />
                <Knob k="sineLevel" patch={p} onChange={onChange} size={56} title="A pure sine at the note's pitch, added after the filter" />
              </div>
            </Section>

            <Section id="effect" title="EFFECT" lit={lit('effect')}>
              <div className="flex gap-1.5 mb-2">
                <PowerButton on={p.fxOn} onClick={() => onChange({ fxOn: !p.fxOn })} aria="Effect on/off" />
                <Menu
                  aria="Effect type"
                  value={p.fxType}
                  dim={!p.fxOn}
                  onChange={(v) => onChange({ fxType: v })}
                  options={[
                    { v: 'flanger', label: 'Flanger' },
                    { v: 'chorus', label: 'Chorus' },
                  ]}
                />
              </div>
              <div className={`flex flex-col items-center gap-4 pt-1 ${p.fxOn ? '' : 'opacity-50'}`}>
                <Knob k="fxMix" patch={p} onChange={onChange} size={56} />
                <Knob k="fxRate" patch={p} onChange={onChange} size={56} />
              </div>
            </Section>
          </div>

          {/* Bottom row: Glide, LFO / Vibrato, Filter Env, Amp Env */}
          <div className="flex gap-1.5 items-stretch">
            <Section id="glide" title="Glide" lit={lit('glide')} titleTop>
              <div className="flex flex-col items-center gap-2">
                <PowerButton on={p.glideOn} onClick={() => onChange({ glideOn: !p.glideOn })} aria="Glide on/off" />
                <div className="flex items-center gap-2 text-[14px]">
                  <span className="text-[#c4c4c8]">Mode</span>
                  <span className="px-2 py-0.5 rounded bg-[#232326] text-[#a1a1aa]" title="Which oscillators glide (All Osc in this copy)">
                    All Osc
                  </span>
                </div>
                <div className={p.glideOn ? '' : 'opacity-50'}>
                  <Knob k="glideTime" patch={p} onChange={onChange} title="How long each note slides to the next" />
                </div>
              </div>
            </Section>

            {mini ? (
              <>
                <Section id="lfo" title="LFO" lit={false} titleTop>
                  <LfoPanel p={p} onChange={onChange} which="lfo" />
                </Section>
                <Section id="lfo" title="VIBRATO" lit={false} titleTop>
                  <LfoPanel p={p} onChange={onChange} which="vib" />
                </Section>
              </>
            ) : (
              <div className={`flex flex-col rounded-[4px] transition-shadow ${lit('lfo') ? 'shadow-[0_0_0_3px_rgba(251,191,36,0.75),0_0_18px_rgba(251,191,36,0.55)]' : ''}`} data-section="lfo">
                {tabs}
                <div className="flex-1 p-2.5 bg-[#2b2b2e] rounded-b-[4px] rounded-tr-[4px]">
                  <LfoPanel key={tab} p={p} onChange={onChange} which={tab} />
                  <div className="h-[3px] w-16 mx-auto rounded-full mt-2" style={{ background: SECTION_COLOR.lfo }} aria-hidden="true" />
                </div>
              </div>
            )}

            <Section id="filterEnv" title="FILTER ENV" lit={lit('filterEnv')} titleTop>
              <div className="flex gap-2 items-end">
                <EnvScreen p={p} onChange={onChange} keys={['fA', 'fD', 'fS', 'fR']} />
                <VSlider k="fVel" patch={p} onChange={onChange} h={120} label="Vel" title="How much playing harder opens the filter (every note here is played at the same strength)" />
              </div>
            </Section>

            <Section id="ampEnv" title="AMP ENV" lit={lit('ampEnv')} titleTop>
              <div className="flex gap-2 items-end">
                <EnvScreen p={p} onChange={onChange} keys={['aA', 'aD', 'aS', 'aR']} />
                <VSlider k="aVel" patch={p} onChange={onChange} h={120} label="Vel" title="How much playing harder makes it louder (every note here is played at the same strength)" />
              </div>
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
};

/** A Retro Synth panel shrunk to fit its box: read-only, with every setting showing. */
export const MiniRetroPanel: React.FC<{ patch: RetroPatch }> = ({ patch }) => (
  <ShrinkToFit>
    <RetroView patch={patch} onChange={() => {}} mini />
  </ShrinkToFit>
);
