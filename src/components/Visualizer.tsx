import React, { useEffect, useRef, useState } from 'react';
import { SubtractiveEngine } from '../audio/synthEngine';
import { ThemeMode } from '../types';
import * as Tone from 'tone';
import { Maximize2, Minimize2 } from 'lucide-react';

interface VisualizerProps {
  engine: SubtractiveEngine;
  theme: ThemeMode;
  height?: number;
}

export const Visualizer: React.FC<VisualizerProps> = ({ engine, theme, height = 160 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [viewMode, setViewMode] = useState<'spectrum' | 'scope'>('scope');
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

      // Clear background with phosphor aesthetic
      ctx.fillStyle = theme === 'hardware-bench' ? '#060a08' : '#050807';
      ctx.fillRect(0, 0, width, h);

      // Draw logarithmic frequency grid lines (20 Hz, 100 Hz, 1 kHz, 10 kHz, 20 kHz)
      const minFreq = 20;
      const maxFreq = 20000;
      const freqToX = (f: number) => {
        const minLog = Math.log10(minFreq);
        const maxLog = Math.log10(maxFreq);
        const fLog = Math.log10(Math.max(minFreq, Math.min(maxFreq, f)));
        return ((fLog - minLog) / (maxLog - minLog)) * width;
      };

      const gridFreqs = [100, 1000, 10000];
      ctx.strokeStyle = theme === 'hardware-bench' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(52, 211, 153, 0.12)';
      ctx.lineWidth = 1;
      ctx.fillStyle = theme === 'hardware-bench' ? 'rgba(34, 197, 94, 0.5)' : 'rgba(52, 211, 153, 0.5)';
      ctx.font = '9px monospace';

      gridFreqs.forEach((freq) => {
        const x = freqToX(freq);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h - 18);
        ctx.stroke();
        ctx.fillText(freq >= 1000 ? `${freq / 1000}k Hz` : `${freq} Hz`, x + 3, h - 22);
      });

      // Draw horizontal dB grid lines
      for (let y = 0; y < h - 18; y += (h - 18) / 4) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // 1. Draw Spectrometer (FFT) with Logarithmic Scaling (20Hz - 20kHz)
      if (viewMode === 'spectrum') {
        const fftData = engine.getFFTData();
        const sampleRate = Tone.getContext().sampleRate || 44100;
        const nyquist = sampleRate / 2;

        ctx.beginPath();
        let started = false;

        const step = 1; // one point per pixel
        const lastBin = fftData.length - 1;
        const binHz = nyquist / fftData.length;
        const minLog = Math.log10(minFreq);
        const maxLog = Math.log10(maxFreq);
        const freqAt = (px: number) => Math.pow(10, minLog + (px / width) * (maxLog - minLog));

        for (let x = 0; x <= width; x += step) {
          // The span of FFT bins this pixel covers on the log axis
          const b0 = freqAt(x - step / 2) / binHz;
          const b1 = freqAt(x + step / 2) / binHz;

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

          // Normalize dB (-90dB to 0dB)
          const normalized = Math.max(0, Math.min(1, (db + 90) / 90));
          const barH = normalized * (h - 28);
          const y = (h - 18) - barH;

          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.lineTo(width, h - 18);
        ctx.lineTo(0, h - 18);
        ctx.closePath();
        ctx.fillStyle = theme === 'hardware-bench' ? 'rgba(34, 197, 94, 0.18)' : 'rgba(52, 211, 153, 0.18)';
        ctx.fill();
        ctx.strokeStyle = theme === 'hardware-bench' ? '#22c55e' : '#34d399';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // 2. Draw Oscilloscope Waveform (if scope mode)
      if (viewMode === 'scope') {
        const waveData = engine.getWaveformData();
        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.strokeStyle = theme === 'hardware-bench' ? '#22c55e' : '#34d399';
        const waveCenter = (h - 18) / 2;
        const waveH = (h - 18) * 0.45;

        // Find rising zero-crossing trigger point to lock waveform phase
        let triggerIndex = 0;
        for (let i = 0; i < waveData.length / 2; i++) {
          if (waveData[i] <= 0 && waveData[i + 1] > 0) {
            triggerIndex = i;
            break;
          }
        }

        // Display a clean window of samples (e.g. 384 samples) to isolate 1-2 stable cycles
        const numSamples = Math.min(384, waveData.length - triggerIndex);
        const sliceWidth = width / numSamples;

        let x = 0;
        for (let i = 0; i < numSamples; i++) {
          const idx = triggerIndex + i;
          if (idx >= waveData.length) break;
          const v = waveData[idx];
          const y = waveCenter + (v * waveH);
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }
        ctx.stroke();
      }

      // CRT Scanline Overlay
      ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
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
  }, [engine, theme, viewMode, isFullScreen]);

  const containerClasses = isFullScreen
    ? "fixed inset-4 md:inset-12 z-50 flex flex-col p-4 bg-slate-950 border-2 border-emerald-500 shadow-2xl rounded-2xl"
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
        id="synth-visualizer-card"
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
                viewMode === m.id
                  ? 'bg-emerald-500 text-black border-emerald-400 font-bold shadow'
                  : 'bg-black/70 hover:bg-black text-emerald-300 border-emerald-800/40'
              }`}
            >
              {m.label}
            </button>
          ))}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setIsFullScreen(!isFullScreen); }}
            className="p-1 rounded bg-black/70 hover:bg-emerald-500 hover:text-black text-emerald-400 border border-emerald-800/60 shadow transition-colors ml-1"
            title={isFullScreen ? "Exit Full Screen" : "Expand to Full Screen"}
          >
            {isFullScreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
          </button>
        </div>

        <canvas
          ref={canvasRef}
          width={isFullScreen ? 1200 : 640}
          height={isFullScreen ? 500 : height}
          className="w-full block flex-1"
        />
      </div>
    </>
  );
};
