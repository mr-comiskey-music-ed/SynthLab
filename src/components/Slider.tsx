import React, { useRef, useState } from 'react';
import { ThemeMode } from '../types';
import { taperPosition, taperValue } from '../utils/taper';
import { useTouchGrab } from '../utils/useTouchGrab';

interface SliderProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  defaultValue?: number;
  unit?: string;
  theme: ThemeMode;
  height?: number; // default 100px
  /** Curved travel: this value sits halfway up the fader (used for envelope times). */
  centerValue?: number;
  section?: 'vco' | 'filter' | 'envelope' | 'lfo' | 'master';
  onChange: (val: number) => void;
}

export const VerticalSlider: React.FC<SliderProps> = ({
  id,
  label,
  value,
  min,
  max,
  step = 0.01,
  defaultValue,
  unit = '',
  theme,
  height = 100,
  centerValue,
  section = 'master',
  onChange,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement | null>(null);

  const normVal =
    centerValue !== undefined
      ? taperPosition(value, min, max, centerValue)
      : Math.max(0, Math.min(1, (value - min) / (max - min)));

  const updateFromY = (clientY: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const trackHeight = rect.height;
    // clientY measured from top of track, value goes from bottom (min) to top (max)
    const ratio = 1 - (clientY - rect.top) / trackHeight;
    const clampedRatio = Math.max(0, Math.min(1, ratio));
    let newVal: number;
    if (centerValue !== undefined) {
      newVal = Math.round(taperValue(clampedRatio, min, max, centerValue) * 1000) / 1000;
    } else {
      newVal = min + clampedRatio * (max - min);
      if (step) newVal = Math.round(newVal / step) * step;
    }
    onChange(newVal);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    updateFromY(e.clientY);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      updateFromY(moveEvent.clientY);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleDoubleClick = () => {
    if (defaultValue !== undefined) {
      onChange(defaultValue);
    }
  };

  // Touch: a quick swipe scrolls the page; press and hold briefly to grab the fader, then drag.
  useTouchGrab(trackRef, {
    onGrab: (y) => {
      setIsDragging(true);
      updateFromY(y);
    },
    onMove: updateFromY,
    onRelease: () => setIsDragging(false),
    onDoubleTap: handleDoubleClick,
  });

  const formatDisplay = (v: number): string => {
    if (unit === 's') {
      return v < 1 ? `${Math.round(v * 1000)}ms` : `${v.toFixed(2)}s`;
    }
    if (unit === '%') {
      return `${Math.round(v * 100)}%`;
    }
    return `${v.toFixed(2)}${unit}`;
  };

  // Section Color accents for Minilogue / Retro themes
  const sectionColors = {
    vco: '#f59e0b', // Amber / Yellow
    filter: '#ef4444', // Red
    envelope: '#10b981', // Green
    lfo: '#3b82f6', // Blue
    master: '#94a3b8', // Slate Grey
  };

  const notchColor = sectionColors[section] || '#f59e0b';

  return (
    <div
      id={id}
      className="flex flex-col items-center select-none group cursor-pointer"
      onDoubleClick={handleDoubleClick}
    >
      {/* Slider Track Container */}
      <div
        ref={trackRef}
        className="relative flex items-center justify-center cursor-ns-resize px-2 py-1 touch-manipulation"
        style={{ height: `${height}px` }}
        onMouseDown={handleMouseDown}
      >
        {/* Track Slot */}
        <div
          className={`w-1.5 h-full rounded-full transition-colors ${
            theme === 'hardware-bench'
              ? 'bg-black/30 border-r border-white/40 shadow-[inset_0_1px_3px_rgba(0,0,0,0.8)]'
              : 'bg-black/70 border-l border-white/5 border-r border-black shadow-[inset_0_2px_4px_rgba(0,0,0,0.9)]'
          }`}
        />

        {/* Graduated Tick Marks on sides */}
        <div className="absolute inset-y-2 left-0 flex flex-col justify-between pointer-events-none opacity-40">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="w-1.5 h-[1px] bg-slate-400" />
          ))}
        </div>
        <div className="absolute inset-y-2 right-0 flex flex-col justify-between pointer-events-none opacity-40">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="w-1.5 h-[1px] bg-slate-400" />
          ))}
        </div>

        {/* Slider Fader Cap */}
        <div
          className={`absolute w-8 h-4 rounded-[2px] transition-transform flex items-center justify-center ${
            theme === 'hardware-bench'
              ? 'bg-gradient-to-b from-[#e2e8f0] via-[#94a3b8] to-[#475569] border border-slate-900 shadow-[0_3px_6px_rgba(0,0,0,0.6)]'
              : 'bg-gradient-to-b from-[#475569] via-[#334155] to-[#1e293b] border border-slate-900 shadow-[0_2px_5px_rgba(0,0,0,0.8)]'
          } ${isDragging ? 'ring-2 ring-amber-400/70 scale-105' : 'group-hover:brightness-110'}`}
          style={{
            bottom: `${normVal * (height - 16)}px`,
          }}
        >
          {/* Center alignment notch line */}
          <div
            className="w-full h-[2px]"
            style={{ backgroundColor: notchColor }}
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
        className={`text-[9px] font-mono tracking-tight px-1 rounded transition-colors ${
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
