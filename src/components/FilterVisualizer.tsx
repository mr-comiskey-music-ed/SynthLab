import React, { useEffect, useRef, useState } from 'react';
import { SubtractiveEngine } from '../audio/synthEngine';
import { ThemeMode, SynthParams } from '../types';
import { Maximize2, Minimize2 } from 'lucide-react';
import { VIZ_FONT, fitCanvas, vizPalette } from './vizUtils';
import { startDrag } from './dragUtils';

interface FilterVisualizerProps {
  engine: SubtractiveEngine;
  theme: ThemeMode;
  height?: number;
  /** Stretch to fill the height its parent gives it (height is then the minimum). */
  fill?: boolean;
  /** Makes the dot draggable: sideways for Cutoff, up and down for Resonance (like the Retro Synth guide's filter screen). */
  onParamChange?: (key: 'filterCutoff' | 'filterResonance', value: number) => void;
}

const MIN_FREQ = 20;
const MAX_FREQ = 20000;
const MIN_LOG = Math.log10(MIN_FREQ);
const MAX_LOG = Math.log10(MAX_FREQ);
const DB_MIN = -48;
const DB_MAX = 42;
const RES_MIN = 0.1;
const RES_MAX = 20;
/** How close (CSS px) a pointer has to be to grab the dot. Generous for fingers. */
const GRAB_RADIUS = 18;

/** Where things were drawn on the last frame, so a pointer can be matched to the dot. */
interface FilterLayout {
  width: number;
  height: number;
  plotTop: number;
  plotBottom: number;
  stages: number;
  dotX: number;
  dotY: number;
}

export const FilterVisualizer: React.FC<FilterVisualizerProps> = ({ engine, theme, height = 130, fill = false, onParamChange }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
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
  const cssHeight = isFullScreen ? 450 : fill ? Math.max(height, fillH) : height;
  const pal = vizPalette(theme);
  const draggable = !!onParamChange;
  const layoutRef = useRef<FilterLayout | null>(null);
  // 'hover' or 'drag' makes the dot bigger, so students can see it can be grabbed.
  const dotStateRef = useRef<'idle' | 'hover' | 'drag'>('idle');
  const onChangeRef = useRef(onParamChange);
  onChangeRef.current = onParamChange;

  /** Pointer position in the canvas's drawing units, and whether it is on the dot. */
  const locate = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const L = layoutRef.current;
    if (!canvas || !L) return null;
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    const x = ((clientX - r.left) * L.width) / r.width;
    const y = ((clientY - r.top) * L.height) / r.height;
    return { x, y, onDot: Math.hypot(x - L.dotX, y - L.dotY) <= GRAB_RADIUS, rect: r, L };
  };

  /** Grab the dot: it follows the pointer (keeping where it was grabbed), sideways = Cutoff, up/down = Res. */
  const beginDrag = (e: React.MouseEvent | React.TouchEvent, clientX: number, clientY: number) => {
    const hit = locate(clientX, clientY);
    if (!hit || !hit.onDot) return false;
    const { L, rect } = hit;
    const offX = hit.x - L.dotX;
    const offY = hit.y - L.dotY;
    dotStateRef.current = 'drag';
    startDrag(e, (cx, cy) => {
      const x = ((cx - rect.left) * L.width) / rect.width - offX;
      const y = ((cy - rect.top) * L.height) / rect.height - offY;
      const t = Math.max(0, Math.min(1, x / L.width));
      const hz = Math.round(Math.pow(10, MIN_LOG + t * (MAX_LOG - MIN_LOG)));
      const db = DB_MIN + ((L.plotBottom - y) / (L.plotBottom - L.plotTop)) * (DB_MAX - DB_MIN);
      const res = Math.round(Math.max(RES_MIN, Math.min(RES_MAX, db / L.stages)) * 10) / 10;
      const p = engine.getParams();
      if (hz !== Math.round(p.filterCutoff)) onChangeRef.current?.('filterCutoff', hz);
      if (res !== p.filterResonance) onChangeRef.current?.('filterResonance', res);
    });
    const end = () => {
      dotStateRef.current = 'idle';
      window.removeEventListener('mouseup', end);
      window.removeEventListener('touchend', end);
      window.removeEventListener('touchcancel', end);
    };
    window.addEventListener('mouseup', end);
    window.addEventListener('touchend', end);
    window.addEventListener('touchcancel', end);
    return true;
  };

  // A touch that starts on the dot drags it and never scrolls; a touch anywhere else scrolls as usual.
  // (A native, non-passive listener, so the scroll can be stopped right at touchstart.)
  const beginDragRef = useRef(beginDrag);
  beginDragRef.current = beginDrag;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !draggable) return;
    const onTouchStart = (ev: TouchEvent) => {
      if (ev.touches.length !== 1) return;
      const t = ev.touches[0];
      if (beginDragRef.current(ev as unknown as React.TouchEvent, t.clientX, t.clientY)) {
        ev.preventDefault();
        ev.stopPropagation();
      }
    };
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    return () => canvas.removeEventListener('touchstart', onTouchStart);
  }, [draggable, isFullScreen]);

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

      const params: SynthParams = engine.getParams();
      const cutoff = params.filterCutoff; // 20 - 20000
      const Q = params.filterResonance; // 0.1 - 20
      const rolloff = params.filterRolloff; // -12 or -24

      const freqToX = (f: number) =>
        ((Math.log10(Math.max(MIN_FREQ, Math.min(MAX_FREQ, f))) - MIN_LOG) / (MAX_LOG - MIN_LOG)) * width;

      // Layout: header gap for the FILTER tag, plot, frequency labels, readout bar
      // Small card: just the curve and its axes. The Cutoff / slope / Res readout is for full screen.
      const compact = !isFullScreen;
      const readoutH = compact ? 0 : 26;
      const axisH = 16;
      const plotTop = compact ? 22 : 30;
      const plotBottom = h - readoutH - axisH;

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

      const dbToY = (db: number) =>
        plotBottom - ((Math.max(DB_MIN, Math.min(DB_MAX, db)) - DB_MIN) / (DB_MAX - DB_MIN)) * (plotBottom - plotTop);

      // ---- Grid ----
      ctx.lineWidth = 1;
      ctx.font = `11px ${VIZ_FONT}`;

      // Level guides (0 dB = everything the filter lets through)
      for (const db of [-24, 0, 24]) {
        const y = Math.round(dbToY(db)) + 0.5;
        ctx.strokeStyle = db === 0 ? pal.gridStrong : pal.grid;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
        ctx.fillStyle = pal.label;
        ctx.textAlign = 'left';
        ctx.fillText(`${db > 0 ? '+' : ''}${db} dB`, 6, y - 3);
      }

      // Frequency guides, labelled in the strip under the plot
      for (const f of [50, 100, 200, 500, 1000, 2000, 5000, 10000]) {
        const x = Math.round(freqToX(f)) + 0.5;
        ctx.strokeStyle = pal.grid;
        ctx.beginPath();
        ctx.moveTo(x, plotTop);
        ctx.lineTo(x, plotBottom);
        ctx.stroke();
        ctx.fillStyle = pal.label;
        ctx.textAlign = 'center';
        ctx.fillText(f >= 1000 ? `${f / 1000}k` : `${f}`, Math.max(14, Math.min(width - 14, x)), plotBottom + 13);
      }
      ctx.textAlign = 'right';
      ctx.fillText('Hz', width - 6, plotBottom + 13);

      // ---- Response curve ----
      const pts: [number, number][] = [];
      let peakDb = -999;
      let peakX = 0;
      for (let x = 0; x <= width; x += 1) {
        const freq = Math.pow(10, MIN_LOG + (x / width) * (MAX_LOG - MIN_LOG));
        const db = stages * stageDb(freq);
        pts.push([x, dbToY(db)]);
        if (db > peakDb) {
          peakDb = db;
          peakX = x;
        }
      }

      // Cutoff marker: dashed line at the cutoff frequency
      const cutX = freqToX(cutoff);
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = pal.gridStrong;
      ctx.beginPath();
      ctx.moveTo(Math.round(cutX) + 0.5, plotTop);
      ctx.lineTo(Math.round(cutX) + 0.5, plotBottom);
      ctx.stroke();
      ctx.restore();

      // Soft fill under the curve
      ctx.beginPath();
      ctx.moveTo(0, plotBottom);
      pts.forEach(([x, y]) => ctx.lineTo(x, y));
      ctx.lineTo(width, plotBottom);
      ctx.closePath();
      ctx.fillStyle = pal.traceFill;
      ctx.fill();

      // The curve itself
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = pal.trace;
      ctx.shadowColor = pal.trace;
      ctx.shadowBlur = pal.glow;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // The dot. When it can be dragged it always sits on the curve at the cutoff, where each
      // filter stage gives exactly Res dB (so up/down maps straight onto Resonance). When it can't,
      // it marks the resonance peak, only when there is a real peak above the passband.
      const dotX = draggable ? cutX : peakX;
      const dotY = draggable ? dbToY(stages * Q) : dbToY(peakDb);
      layoutRef.current = { width, height: h, plotTop, plotBottom, stages, dotX, dotY };
      if (draggable || peakDb > 0.8) {
        const big = draggable && dotStateRef.current !== 'idle';
        if (draggable) {
          // A soft ring so the dot reads as something to grab.
          ctx.beginPath();
          ctx.arc(dotX, dotY, big ? 11 : 8, 0, Math.PI * 2);
          ctx.fillStyle = pal.traceFill;
          ctx.fill();
          ctx.strokeStyle = pal.gridStrong;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(dotX, dotY, big ? 6 : 4.5, 0, Math.PI * 2);
        ctx.fillStyle = pal.trace;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // ---- Readout bar: Cutoff | slope | Resonance (full screen only) ----
      if (!compact) {
      ctx.fillStyle = pal.readoutBg;
      ctx.fillRect(0, h - readoutH, width, readoutH);
      ctx.strokeStyle = pal.gridStrong;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h - readoutH + 0.5);
      ctx.lineTo(width, h - readoutH + 0.5);
      ctx.stroke();

      ctx.font = `600 13px ${VIZ_FONT}`;
      ctx.fillStyle = pal.readoutText;
      ctx.textBaseline = 'middle';
      const ry = h - readoutH / 2 + 1;

      const cutoffVal = cutoff >= 1000 ? `${(cutoff / 1000).toFixed(2)} kHz` : `${Math.round(cutoff)} Hz`;
      ctx.textAlign = 'left';
      ctx.fillText(`Cutoff ${cutoffVal}`, 12, ry);

      ctx.textAlign = 'center';
      ctx.fillText(`${Math.abs(rolloff)} dB/oct`, width / 2, ry);

      const peakText = peakDb > 0.8 ? `  (+${Math.round(peakDb)} dB)` : '';
      ctx.textAlign = 'right';
      ctx.fillText(`Res ${params.filterResonance.toFixed(1)}${peakText}`, width - 12, ry);
      ctx.textBaseline = 'alphabetic';
      }

      animFrameId.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameId.current) {
        cancelAnimationFrame(animFrameId.current);
      }
    };
  }, [engine, theme, cssHeight, isFullScreen, draggable]);

  const containerClasses = isFullScreen
    ? 'fixed inset-4 md:inset-12 z-50 flex flex-col p-4 bg-slate-950 border-2 border-amber-500 shadow-2xl rounded-2xl'
    : `relative rounded-lg overflow-hidden border shadow-inner transition-all ${fill ? 'h-full' : ''} ${pal.card}`;

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
        ref={cardRef}
        className={containerClasses}
        onDoubleClick={(e) => {
          if (locate(e.clientX, e.clientY)?.onDot) return; // double-clicking the dot isn't a full-screen request
          setIsFullScreen(!isFullScreen);
        }}
        title={draggable ? 'Drag the dot: sideways for Cutoff, up and down for Resonance · double-click to toggle full screen' : 'Double-click to toggle full screen'}
      >
        <div className="absolute top-2 left-3 z-10 flex items-center gap-2 pointer-events-none">
          <span
            className="text-[11px] uppercase font-mono tracking-widest font-bold"
            style={{ color: pal.readoutText }}
          >
            Filter response
          </span>
        </div>

        {/* Fullscreen Toggle Button at Top Right */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setIsFullScreen(!isFullScreen); }}
          className="absolute top-2 right-2.5 z-10 p-1 rounded bg-black/70 hover:bg-amber-500 hover:text-black text-amber-400 border border-amber-800/60 shadow transition-colors"
          title={isFullScreen ? 'Exit Full Screen' : 'Expand to Full Screen'}
        >
          {isFullScreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
        </button>

        <canvas
          ref={canvasRef}
          className={fill && !isFullScreen ? 'absolute inset-0 w-full h-full block' : 'w-full block'}
          style={fill && !isFullScreen ? undefined : { height: cssHeight }}
          role={draggable ? 'slider' : undefined}
          aria-label={draggable ? 'Filter: drag the dot sideways for Cutoff, up and down for Resonance' : undefined}
          onMouseDown={draggable ? (e) => { if (beginDrag(e, e.clientX, e.clientY)) e.stopPropagation(); } : undefined}
          onMouseMove={draggable ? (e) => {
            if (dotStateRef.current === 'drag') return;
            const on = !!locate(e.clientX, e.clientY)?.onDot;
            dotStateRef.current = on ? 'hover' : 'idle';
            e.currentTarget.style.cursor = on ? 'move' : '';
          } : undefined}
          onMouseLeave={draggable ? (e) => {
            if (dotStateRef.current === 'hover') dotStateRef.current = 'idle';
            e.currentTarget.style.cursor = '';
          } : undefined}
        />
      </div>
    </>
  );
};
