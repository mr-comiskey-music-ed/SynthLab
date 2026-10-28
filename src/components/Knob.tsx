import React, { useRef, useState, useEffect } from 'react';
import { ThemeMode } from '../types';
import { taperPosition, taperValue } from '../utils/taper';

interface KnobProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  defaultValue?: number;
  unit?: string;
  /** Custom readout for the value under the knob (overrides the unit formatting). */
  format?: (v: number) => string;
  section?: 'vco' | 'filter' | 'envelope' | 'lfo' | 'master';
  theme: ThemeMode;
  logarithmic?: boolean;
  /** Curved travel: this value sits at 12 o'clock (used for envelope times). */
  centerValue?: number;
  size?: 'sm' | 'md' | 'lg';
  /**
   * Shows what the LFO is doing to this knob: a cyan arc for the range it sweeps either side of the
   * knob's setting (`amount`, in the knob's own units) and a dot that moves at the LFO's rate and shape.
   */
  /**
   * Ties a knob to the Envelope section by its green: 'link' is a subtle always-on ring,
   * 'hot' is the strong pulsing ring used when a Learn step is pointing at this knob.
   */
  egRing?: 'link' | 'hot';
  lfoSwing?: { amount: number; rate: number; waveform: 'sine' | 'triangle' | 'sawtooth' | 'square' };
  onChange: (val: number) => void;
}

export const Knob: React.FC<KnobProps> = ({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  defaultValue,
  unit = '',
  format,
  section = 'master',
  theme,
  logarithmic = false,
  centerValue,
  size = 'md',
  lfoSwing,
  egRing,
  onChange,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(0);
  const startValRef = useRef(value);

  // Map value to 0..1 normalized
  const toNormalized = (val: number): number => {
    if (centerValue !== undefined) return taperPosition(val, min, max, centerValue);
    if (logarithmic) {
      const minL = Math.log(Math.max(0.001, min));
      const maxL = Math.log(max);
      return (Math.log(Math.max(0.001, val)) - minL) / (maxL - minL);
    }
    return (val - min) / (max - min);
  };

  const fromNormalized = (norm: number): number => {
    const clamped = Math.max(0, Math.min(1, norm));
    if (centerValue !== undefined) return taperValue(clamped, min, max, centerValue);
    if (logarithmic) {
      const minL = Math.log(Math.max(0.001, min));
      const maxL = Math.log(max);
      return Math.exp(minL + clamped * (maxL - minL));
    }
    return min + clamped * (max - min);
  };

  const normVal = toNormalized(value);
  // Knobs rotate -135 deg to +135 deg (270 degree sweep)
  const angle = -135 + normVal * 270;

  // LFO cue: the arc covers the real sweep (clamped to the knob's travel); the dot rides it live.
  const swingActive = !!lfoSwing && lfoSwing.amount > 0;
  const swingLoNorm = swingActive ? toNormalized(Math.max(min, value - lfoSwing!.amount)) : 0;
  const swingHiNorm = swingActive ? toNormalized(Math.min(max, value + lfoSwing!.amount)) : 0;
  const swingDotRef = useRef<SVGCircleElement | null>(null);
  const swingKey = swingActive
    ? `${lfoSwing!.rate}|${lfoSwing!.waveform}|${swingLoNorm.toFixed(4)}|${swingHiNorm.toFixed(4)}`
    : '';
  useEffect(() => {
    if (!swingActive) return;
    const { rate, waveform } = lfoSwing!;
    const lo = swingLoNorm;
    const hi = swingHiNorm;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const ph = (((now - t0) / 1000) * Math.max(0.1, rate)) % 1;
      const w =
        waveform === 'sine' ? Math.sin(ph * 2 * Math.PI)
        : waveform === 'triangle' ? 4 * Math.abs(ph - 0.5) - 1
        : waveform === 'sawtooth' ? 2 * ph - 1
        : ph < 0.5 ? 1 : -1;
      // The LFO swings both ways around the setting, so the knob's own position is the middle.
      const n = Math.max(lo, Math.min(hi, normVal + (w >= 0 ? w * (hi - normVal) : w * (normVal - lo))));
      const a = ((-135 + n * 270) * Math.PI) / 180;
      const dot = swingDotRef.current;
      if (dot) {
        dot.setAttribute('cx', String(50 + 44 * Math.sin(a)));
        dot.setAttribute('cy', String(50 - 44 * Math.cos(a)));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swingKey, normVal, swingActive]);
  const arcPoint = (n: number) => {
    const a = ((-135 + n * 270) * Math.PI) / 180;
    return `${(50 + 44 * Math.sin(a)).toFixed(2)} ${(50 - 44 * Math.cos(a)).toFixed(2)}`;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startYRef.current = e.clientY;
    startValRef.current = normVal;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = startYRef.current - moveEvent.clientY;
      const sensitivity = 0.006;
      const newNorm = Math.max(0, Math.min(1, startValRef.current + deltaY * sensitivity));
      let newVal = fromNormalized(newNorm);
      if (centerValue !== undefined) {
        newVal = Math.round(newVal * 1000) / 1000;
      } else if (step && !logarithmic) {
        newVal = Math.round(newVal / step) * step;
      }
      onChange(newVal);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Touch: only the dial itself grabs a touch (it has touch-action: none), so a swipe
  // that starts on the label, readout or panel still scrolls the page.
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    setIsDragging(true);
    startYRef.current = e.touches[0].clientY;
    startValRef.current = normVal;

    const handleTouchMove = (moveEvent: TouchEvent) => {
      if (moveEvent.touches.length !== 1) return;
      // Backup for browsers that ignore touch-action: keep the page still while turning.
      if (moveEvent.cancelable) moveEvent.preventDefault();
      const deltaY = startYRef.current - moveEvent.touches[0].clientY;
      const sensitivity = 0.006;
      const newNorm = Math.max(0, Math.min(1, startValRef.current + deltaY * sensitivity));
      let newVal = fromNormalized(newNorm);
      if (centerValue !== undefined) {
        newVal = Math.round(newVal * 1000) / 1000;
      } else if (step && !logarithmic) {
        newVal = Math.round(newVal / step) * step;
      }
      onChange(newVal);
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);
  };

  const handleDoubleClick = () => {
    if (defaultValue !== undefined) {
      onChange(defaultValue);
    }
  };

  // Format value display
  const formatDisplay = (v: number): string => {
    if (format) return format(v);
    if (unit === 'Hz') {
      return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v.toFixed(1)} Hz`;
    }
    if (unit === 's') {
      return v < 1 ? `${Math.round(v * 1000)}ms` : `${v.toFixed(2)}s`;
    }
    if (unit === '%') {
      return `${Math.round(v)}%`;
    }
    if (unit === 'cents') {
      return `${v > 0 ? '+' : ''}${Math.round(v)}c`;
    }
    if (unit === 'semi') {
      return `${v > 0 ? '+' : ''}${Math.round(v)}`;
    }
    if (Number.isInteger(v)) {
      return `${v}${unit}`;
    }
    return `${v.toFixed(1)}${unit}`;
  };

  // Section Color accents for Minilogue / Retro themes
  const sectionColors = {
    vco: '#f59e0b', // Amber / Yellow
    filter: '#ef4444', // Red
    envelope: '#10b981', // Green
    lfo: '#3b82f6', // Blue
    master: '#94a3b8', // Slate Grey
  };

  const pointerColor = sectionColors[section] || '#fde047';

  const knobDiameter = size === 'sm' ? 'w-10 h-10' : size === 'lg' ? 'w-14 h-14' : 'w-12 h-12';

  return (
    <div
      id={id}
      className="flex flex-col items-center select-none group cursor-ns-resize"
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      <div className="relative flex items-center justify-center p-1 touch-none" onTouchStart={handleTouchStart}>
        {/* LFO cue: the range the LFO sweeps either side of the setting, with a dot moving at the LFO's rate */}
        {swingActive ? (
          <svg viewBox="0 0 100 100" className="absolute w-[134%] h-[134%] pointer-events-none overflow-visible" aria-hidden="true">
            {/* the knob's full travel, faint */}
            <path d={`M ${arcPoint(0)} A 44 44 0 1 1 ${arcPoint(1)}`} fill="none" stroke="rgba(6, 182, 212, 0.16)" strokeWidth="2" strokeLinecap="round" />
            {/* the part the LFO actually covers */}
            <path
              d={`M ${arcPoint(swingLoNorm)} A 44 44 0 ${swingHiNorm - swingLoNorm > 0.667 ? 1 : 0} 1 ${arcPoint(swingHiNorm)}`}
              fill="none"
              stroke="#06b6d4"
              strokeWidth="4"
              strokeLinecap="round"
              opacity="0.9"
            />
            <circle ref={swingDotRef} cx="50" cy="6" r="3.6" fill="#ecfeff" stroke="#0891b2" strokeWidth="1.5" />
          </svg>
        ) : null}

        {/* Knob Body */}
        <div
          className={`${knobDiameter} rounded-full flex items-center justify-center transition-transform ${
            theme === 'hardware-bench'
              ? 'bg-gradient-to-b from-[#3a3f47] to-[#1e2329] border border-[#525a66] shadow-[0_4px_8px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.2)]'
              : 'bg-gradient-to-b from-[#24282f] to-[#121417] border border-[#3e4552] shadow-[0_3px_6px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.15)]'
          } ${isDragging ? 'ring-2 ring-amber-400/50 scale-[1.03]' : 'group-hover:border-slate-400'} ${
            egRing === 'hot'
              ? 'ring-[3px] ring-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.75)] animate-pulse'
              : egRing === 'link'
              ? 'ring-1 ring-emerald-500/50'
              : ''
          }`}
          style={{ transform: `rotate(${angle}deg)` }}
        >
          {/* Knob pointer line */}
          <div
            className="w-1 h-3 rounded-full absolute top-1 shadow-sm"
            style={{ backgroundColor: pointerColor }}
          />

          {/* Inner fluted metal cap */}
          <div
            className={`w-5 h-5 rounded-full ${
              theme === 'hardware-bench'
                ? 'bg-gradient-to-br from-[#2b3038] to-[#15181d] border border-black/40'
                : 'bg-gradient-to-br from-[#1a1d22] to-[#0c0e11] border border-white/5'
            }`}
          />
        </div>
      </div>

      {/* Label */}
      <span
        className={`text-[10px] font-semibold tracking-wider uppercase mt-1 transition-colors ${
          theme === 'hardware-bench'
            ? 'text-slate-800 font-sans'
            : 'text-amber-100/90 font-mono text-[9px]'
        }`}
      >
        {label}
      </span>

      {/* Value Readout */}
      <span
        className={`text-[10px] font-mono tracking-tight px-1 rounded transition-colors ${
          theme === 'hardware-bench'
            ? 'text-slate-700 bg-black/5'
            : 'text-amber-300/90 bg-black/40 border border-amber-950/40'
        }`}
      >
        {formatDisplay(value)}
      </span>
    </div>
  );
};
