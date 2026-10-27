import React, { useEffect, useRef, useState } from 'react';
import { SubtractiveEngine } from '../audio/synthEngine';
import { ThemeMode } from '../types';
import * as Tone from 'tone';
import { Maximize2, Minimize2 } from 'lucide-react';
import { VIZ_FONT, fitCanvas, vizPalette } from './vizUtils';

interface VisualizerProps {
  engine: SubtractiveEngine;
  theme: ThemeMode;
  height?: number;
  /** Stretch to fill the height its parent gives it (height is then the minimum). */
  fill?: boolean;
}

export const Visualizer: React.FC<VisualizerProps> = ({ engine, theme, height = 160, fill = false }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [viewMode, setViewMode] = useState<'spectrum' | 'scope'>('scope');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const animFrameId = useRef<number | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [fillH, setFillH] = useState(0);
  useEffect(() => {
    if (!fill || isFullScreen) return;
    const el = cardRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setFillH(Math.round(el.clientHeight)));
    ro.observe(el);
    setFillH(Math.round(el.clientHeight));
    return () => ro.disconnect();
  }, [fill, isFullScreen]);
  const cssHeight = isFullScreen ? 480 : fill ? Math.max(height, fillH) : height;
  const pal = vizPalette(theme);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const render = () => {
      const fit = fitCanvas(canvas, cssHeight);
      if (!fit) return;
      const { ctx, width, height: h } = fit;

      ctx.fillStyle = pal.bg;
      ctx.fillRect(0, 0, width, h);
      ctx.lineJoin = 'round';

      // ---------------- Spectrogram (log frequency axis, 20 Hz - 20 kHz) ----------------
      if (viewMode === 'spectrum') {
        const minFreq = 20;
        const maxFreq = 20000;
        const minLog = Math.log10(minFreq);
        const maxLog = Math.log10(maxFreq);
        const freqToX = (f: number) => ((Math.log10(f) - minLog) / (maxLog - minLog)) * width;
        const freqAt = (px: number) => Math.pow(10, minLog + (px / width) * (maxLog - minLog));

        const plotTop = 10;
        const plotBottom = h - 20;
        const DB_MIN = -90;
        const dbToY = (db: number) =>
          plotBottom - Math.max(0, Math.min(1, (db - DB_MIN) / -DB_MIN)) * (plotBottom - plotTop);

        // Grid + labels
        ctx.lineWidth = 1;
        ctx.font = `11px ${VIZ_FONT}`;
        ctx.textBaseline = 'alphabetic';

        for (const db of [-20, -40, -60, -80]) {
          const y = Math.round(dbToY(db)) + 0.5;
          ctx.strokeStyle = pal.grid;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
          ctx.fillStyle = pal.label;
          ctx.textAlign = 'left';
          ctx.fillText(`${db} dB`, 6, y - 3);
        }

        for (const f of [50, 100, 200, 500, 1000, 2000, 5000, 10000]) {
          const x = Math.round(freqToX(f)) + 0.5;
          ctx.strokeStyle = pal.grid;
          ctx.beginPath();
          ctx.moveTo(x, plotTop);
          ctx.lineTo(x, plotBottom);
          ctx.stroke();
          ctx.fillStyle = pal.label;
          ctx.textAlign = 'center';
          ctx.fillText(f >= 1000 ? `${f / 1000}k` : `${f}`, Math.max(14, Math.min(width - 14, x)), h - 6);
        }
        ctx.textAlign = 'right';
        ctx.fillText('Hz', width - 6, h - 6);

        // Spectrum trace
        const fftData = engine.getFFTData();
        const sampleRate = Tone.getContext().sampleRate || 44100;
        const nyquist = sampleRate / 2;
        const binHz = nyquist / fftData.length;
        const lastBin = fftData.length - 1;

        // One y value per pixel column
        const ys: number[] = [];
        for (let x = 0; x <= width; x += 1) {
          // The span of FFT bins this pixel covers on the log axis
          const b0 = freqAt(x - 0.5) / binHz;
          const b1 = freqAt(x + 0.5) / binHz;

          let db: number;
          if (b1 - b0 < 1) {
            // Low end: fewer than one bin per pixel, so interpolate between neighbouring bins
            const b = Math.max(0, Math.min(lastBin, (b0 + b1) / 2));
            const lo = Math.floor(b);
            const hi = Math.min(lastBin, lo + 1);
            const t = b - lo;
            db = fftData[lo] * (1 - t) + fftData[hi] * t;
          } else {
            // High end: many bins per pixel, so keep the loudest one so narrow peaks never vanish
            const from = Math.max(0, Math.floor(b0));
            const to = Math.min(lastBin, Math.ceil(b1));
            db = -Infinity;
            for (let i = from; i <= to; i++) if (fftData[i] > db) db = fftData[i];
          }
          ys.push(dbToY(db));
        }

        // Soft fill under the trace
        ctx.beginPath();
        ctx.moveTo(0, plotBottom);
        ys.forEach((y, x) => ctx.lineTo(x, y));
        ctx.lineTo(width, plotBottom);
        ctx.closePath();
        ctx.fillStyle = pal.traceFill;
        ctx.fill();

        // The trace line on top
        ctx.beginPath();
        ys.forEach((y, x) => (x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
        ctx.strokeStyle = pal.trace;
        ctx.lineWidth = 1.75;
        ctx.shadowColor = pal.trace;
        ctx.shadowBlur = pal.glow;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // ---------------- Oscilloscope (no text, just a clean graticule) ----------------
      if (viewMode === 'scope') {
        ctx.lineWidth = 1;
        // Graticule: 8 columns, 4 rows, brighter centre line
        for (let i = 1; i < 8; i++) {
          const x = Math.round((i / 8) * width) + 0.5;
          ctx.strokeStyle = pal.grid;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
          ctx.stroke();
        }
        for (let i = 1; i < 4; i++) {
          const y = Math.round((i / 4) * h) + 0.5;
          ctx.strokeStyle = i === 2 ? pal.gridStrong : pal.grid;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }

        const waveData = engine.getWaveformData();
        const waveCenter = h / 2;
        const waveH = h * 0.42;

        // Find rising zero-crossing trigger point to lock waveform phase
        let triggerIndex = 0;
        for (let i = 0; i < waveData.length / 2; i++) {
          if (waveData[i] <= 0 && waveData[i + 1] > 0) {
            triggerIndex = i;
            break;
          }
        }

        // Display a clean window of samples to isolate 1-2 stable cycles
        const numSamples = Math.min(384, waveData.length - triggerIndex);
        const sliceWidth = width / numSamples;

        ctx.beginPath();
        for (let i = 0; i < numSamples; i++) {
          const v = waveData[triggerIndex + i];
          const x = i * sliceWidth;
          const y = waveCenter - v * waveH;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = pal.trace;
        ctx.lineWidth = 2;
        ctx.shadowColor = pal.trace;
        ctx.shadowBlur = pal.glow;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      animFrameId.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameId.current) {
        cancelAnimationFrame(animFrameId.current);
      }
    };
  }, [engine, theme, viewMode, cssHeight]);

  const containerClasses = isFullScreen
    ? 'fixed inset-4 md:inset-12 z-50 flex flex-col p-4 bg-slate-950 border-2 border-amber-500 shadow-2xl rounded-2xl'
    : `relative rounded-lg overflow-hidden border shadow-inner transition-all ${fill ? 'h-full' : ''} ${pal.card}`;

  const activeBtn =
    theme === 'hardware-bench'
      ? 'bg-green-400 text-black border-green-300 font-bold shadow'
      : 'bg-amber-500 text-black border-amber-400 font-bold shadow';
  const idleBtn =
    theme === 'hardware-bench'
      ? 'bg-black/70 hover:bg-black text-green-300 border-green-800/40'
      : 'bg-black/70 hover:bg-black text-amber-300 border-amber-800/40';

  return (
    <>
      {isFullScreen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40"
          onClick={() => setIsFullScreen(false)}
        />
      )}
      <div
        id="synth-visualizer-card"
        ref={cardRef}
        className={containerClasses}
        onDoubleClick={() => setIsFullScreen(!isFullScreen)}
        title="Double-click to toggle full screen"
      >
        <div className="absolute top-2 right-2.5 z-10 flex items-center gap-1">
          {([
            { id: 'scope', label: 'Oscilloscope' },
            { id: 'spectrum', label: 'Spectrogram' },
          ] as const).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={(e) => { e.stopPropagation(); setViewMode(m.id); }}
              className={`px-2 py-0.5 text-[10px] font-mono uppercase rounded border transition-colors ${
                viewMode === m.id ? activeBtn : idleBtn
              }`}
            >
              {m.label}
            </button>
          ))}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setIsFullScreen(!isFullScreen); }}
            className="p-1 rounded bg-black/70 hover:bg-amber-500 hover:text-black text-amber-400 border border-amber-800/60 shadow transition-colors ml-1"
            title={isFullScreen ? 'Exit Full Screen' : 'Expand to Full Screen'}
          >
            {isFullScreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
          </button>
        </div>

        <canvas
          ref={canvasRef}
          className={fill && !isFullScreen ? 'absolute inset-0 w-full h-full block' : 'w-full block'}
          style={fill && !isFullScreen ? undefined : { height: cssHeight }}
        />
      </div>
    </>
  );
};
