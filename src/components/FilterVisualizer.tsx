import React, { useEffect, useRef, useState } from 'react';
import { SubtractiveEngine } from '../audio/synthEngine';
import { ThemeMode, SynthParams } from '../types';
import { Maximize2, Minimize2 } from 'lucide-react';

interface FilterVisualizerProps {
  engine: SubtractiveEngine;
  theme: ThemeMode;
  height?: number;
}

export const FilterVisualizer: React.FC<FilterVisualizerProps> = ({ engine, theme, height = 130 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const animFrameId = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const width = canvas.width;
      const h = canvas.height;

      // Clear background with OLED aesthetic
      ctx.fillStyle = theme === 'hardware-bench' ? '#060a08' : '#050807';
      ctx.fillRect(0, 0, width, h);

      const params: SynthParams = engine.getParams();
      const cutoff = params.filterCutoff; // 20 - 20000
      const Q = params.filterResonance; // 0.1 - 20
      const rolloff = params.filterRolloff; // -12 or -24

      const minFreq = 20;
      const maxFreq = 20000;
      const freqToX = (f: number) => {
        const minLog = Math.log10(minFreq);
        const maxLog = Math.log10(maxFreq);
        const fLog = Math.log10(Math.max(minFreq, Math.min(maxFreq, f)));
        return ((fLog - minLog) / (maxLog - minLog)) * width;
      };

      // Draw grid lines for frequency
      const gridFreqs = [100, 1000, 10000];
      ctx.strokeStyle = theme === 'hardware-bench' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(245, 158, 11, 0.1)';
      ctx.lineWidth = 1;
      ctx.fillStyle = theme === 'hardware-bench' ? 'rgba(34, 197, 94, 0.5)' : 'rgba(245, 158, 11, 0.6)';
      ctx.font = '9px monospace';

      gridFreqs.forEach((freq) => {
        const x = freqToX(freq);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h - 22);
        ctx.stroke();
        ctx.fillText(freq >= 1000 ? `${freq / 1000}k` : `${freq}`, x + 2, h - 26);
      });

      // Draw Filter Response Curve (Logic Pro Retro Synth style)
      ctx.beginPath();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = theme === 'hardware-bench' ? '#22c55e' : '#f59e0b';
      ctx.shadowColor = theme === 'hardware-bench' ? '#22c55e' : '#f59e0b';
      ctx.shadowBlur = 8;

      // The real response of the engine's filter: Tone cascades one 2-pole biquad per
      // 12 dB/oct, each with the same Q (in dB, as in Web Audio), so poles x Q dB of peak.
      const stages = Math.abs(rolloff) / 12;
      const fs = 48000;
      const w0 = (2 * Math.PI * Math.min(cutoff, 0.45 * fs)) / fs;
      const qLin = Math.pow(10, Q / 20);
      const alpha = Math.sin(w0) / (2 * qLin);
      const cosw = Math.cos(w0);
      const b0 = (1 - cosw) / 2, b1 = 1 - cosw, b2 = b0;
      const a0 = 1 + alpha, a1 = -2 * cosw, a2 = 1 - alpha;
      const stageDb = (f: number) => {
        const w = (2 * Math.PI * f) / fs;
        const c1 = Math.cos(w), s1 = Math.sin(w), c2 = Math.cos(2 * w), s2 = Math.sin(2 * w);
        const nr = b0 + b1 * c1 + b2 * c2, ni = -(b1 * s1 + b2 * s2);
        const dr = a0 + a1 * c1 + a2 * c2, di = -(a1 * s1 + a2 * s2);
        return 10 * Math.log10((nr * nr + ni * ni) / (dr * dr + di * di));
      };

      const DB_MIN = -48;
      const DB_MAX = 42;
      const plotTop = 24;
      const plotBottom = h - 26;
      const dbToY = (db: number) => plotBottom - ((Math.max(DB_MIN, Math.min(DB_MAX, db)) - DB_MIN) / (DB_MAX - DB_MIN)) * (plotBottom - plotTop);

      // Level guides: 0 dB is the level of everything the filter lets through.
      ctx.save();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 1;
      ctx.font = '9px monospace';
      for (const db of [-24, 0, 24]) {
        const y = dbToY(db);
        ctx.strokeStyle = db === 0 ? (theme === 'hardware-bench' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(245, 158, 11, 0.3)') : (theme === 'hardware-bench' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(245, 158, 11, 0.1)');
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
        ctx.fillStyle = theme === 'hardware-bench' ? 'rgba(34, 197, 94, 0.5)' : 'rgba(245, 158, 11, 0.6)';
        ctx.fillText(`${db > 0 ? '+' : ''}${db} dB`, width - 44, y - 3);
      }
      ctx.restore();

      const pts: [number, number, number][] = [];
      let peakDb = -999;
      let peakX = 0;
      for (let x = 0; x <= width; x += 1) {
        const freq = Math.pow(10, Math.log10(minFreq) + (x / width) * (Math.log10(maxFreq) - Math.log10(minFreq)));
        const db = stages * stageDb(freq);
        pts.push([x, dbToY(db), db]);
        if (db > peakDb) {
          peakDb = db;
          peakX = x;
        }
      }

      // Soft fill under the curve, then the curve itself.
      ctx.beginPath();
      ctx.moveTo(0, plotBottom);
      pts.forEach(([x, y]) => ctx.lineTo(x, y));
      ctx.lineTo(width, plotBottom);
      ctx.closePath();
      ctx.fillStyle = theme === 'hardware-bench' ? 'rgba(34, 197, 94, 0.08)' : 'rgba(245, 158, 11, 0.08)';
      ctx.fill();

      ctx.beginPath();
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = theme === 'hardware-bench' ? '#22c55e' : '#f59e0b';
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 8;
      pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Dot on the resonance peak, only when there is a real peak above the passband.
      if (peakDb > 0.8) {
        ctx.beginPath();
        ctx.arc(peakX, dbToY(peakDb), 4.5, 0, Math.PI * 2);
        ctx.fillStyle = theme === 'hardware-bench' ? '#22c55e' : '#f59e0b';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Bottom Readout bar (Logic Pro Retro Synth style: Cutoff & Res)
      ctx.fillStyle = theme === 'hardware-bench' ? '#040705' : '#040705';
      ctx.fillRect(0, h - 22, width, 22);
      ctx.strokeStyle = theme === 'hardware-bench' ? 'rgba(34, 197, 94, 0.25)' : 'rgba(245, 158, 11, 0.25)';
      ctx.beginPath();
      ctx.moveTo(0, h - 22);
      ctx.lineTo(width, h - 22);
      ctx.stroke();

      ctx.fillStyle = theme === 'hardware-bench' ? '#4ade80' : '#fbbf24';
      ctx.font = '11px monospace';
      const cutoffVal = params.filterCutoff >= 1000 ? (params.filterCutoff / 1000).toFixed(2) + ' kHz' : Math.round(params.filterCutoff) + ' Hz';
      ctx.fillText(`Cutoff: ${cutoffVal}`, 12, h - 7);
      const peakText = peakDb > 0.8 ? `  (+${Math.round(peakDb)} dB peak)` : '';
      const resText = `Res: ${params.filterResonance.toFixed(1)}${peakText}`;
      ctx.fillText(resText, width - 12 - ctx.measureText(resText).width, h - 7);

      // CRT Scanline Overlay
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      for (let y = 0; y < h; y += 3) {
        ctx.fillRect(0, y, width, 1);
      }

      animFrameId.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameId.current) {
        cancelAnimationFrame(animFrameId.current);
      }
    };
  }, [engine, theme, isFullScreen]);

  const containerClasses = isFullScreen
    ? "fixed inset-4 md:inset-12 z-50 flex flex-col p-4 bg-slate-950 border-2 border-amber-500 shadow-2xl rounded-2xl"
    : `relative rounded-lg overflow-hidden border shadow-inner transition-all ${
        theme === 'hardware-bench'
          ? 'bg-[#060a08] border-[#1f2923] shadow-black/80'
          : 'bg-[#050807] border-[#18231d] shadow-black/80'
      }`;

  return (
    <>
      {isFullScreen && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40" 
          onClick={() => setIsFullScreen(false)} 
        />
      )}
      <div
        id="filter-visualizer-card"
        className={containerClasses}
        onDoubleClick={() => setIsFullScreen(!isFullScreen)}
        title="Double-click to toggle full screen"
      >
        <div className="absolute top-2 left-3 z-10 flex items-center gap-2 pointer-events-none">
          <span className="text-[11px] uppercase font-mono tracking-widest text-amber-300/95 font-bold">
            FILTER
          </span>
        </div>

        {/* Fullscreen Toggle Button at Top Right */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setIsFullScreen(!isFullScreen); }}
          className="absolute top-2 right-2.5 z-10 p-1 rounded bg-black/70 hover:bg-amber-500 hover:text-black text-amber-400 border border-amber-800/60 shadow transition-colors"
          title={isFullScreen ? "Exit Full Screen" : "Expand to Full Screen"}
        >
          {isFullScreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
        </button>

        <canvas
          ref={canvasRef}
          width={isFullScreen ? 1200 : 640}
          height={isFullScreen ? 450 : height}
          className="w-full block flex-1"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>
    </>
  );
};
