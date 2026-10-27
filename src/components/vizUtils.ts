import { ThemeMode } from '../types';

/** Font used inside the canvas displays (same family the rest of the app uses for panel labels). */
export const VIZ_FONT = "'Barlow Semi Condensed', 'Barlow', system-ui, sans-serif";

export interface VizPalette {
  bg: string;
  trace: string;
  traceFill: string;
  grid: string;
  gridStrong: string;
  label: string;
  readoutBg: string;
  readoutText: string;
  /** Soft glow on traces (retro phosphor look); 0 = crisp, flat OLED look. */
  glow: number;
  /** Tailwind classes for the outer card. */
  card: string;
}

/**
 * One palette per synth look, shared by the scope, spectrogram and filter displays
 * so they always match each other:
 *  - studio-retro: warm amber phosphor, with a soft glow
 *  - hardware-bench: flat green OLED, crisp lines and no glow
 */
export const vizPalette = (theme: ThemeMode): VizPalette =>
  theme === 'hardware-bench'
    ? {
        bg: '#050a07',
        trace: '#4ade80',
        traceFill: 'rgba(74, 222, 128, 0.14)',
        grid: 'rgba(74, 222, 128, 0.14)',
        gridStrong: 'rgba(74, 222, 128, 0.35)',
        label: 'rgba(187, 247, 208, 0.85)',
        readoutBg: '#030704',
        readoutText: '#86efac',
        glow: 0,
        card: 'bg-[#050a07] border-[#1f2923] shadow-black/80',
      }
    : {
        bg: '#0a0806',
        trace: '#f59e0b',
        traceFill: 'rgba(245, 158, 11, 0.14)',
        grid: 'rgba(245, 158, 11, 0.14)',
        gridStrong: 'rgba(245, 158, 11, 0.35)',
        label: 'rgba(253, 224, 71, 0.85)',
        readoutBg: '#060504',
        readoutText: '#fbbf24',
        glow: 6,
        card: 'bg-[#0a0806] border-amber-900/50 shadow-black/80',
      };

/**
 * Sizes a canvas to its on-screen size times the device pixel ratio so text and lines are sharp
 * (the old fixed 640px canvas was stretched, which is what made labels look pixelated).
 * Returns a context already scaled so you draw in CSS pixels, plus that CSS width and height.
 */
export function fitCanvas(
  canvas: HTMLCanvasElement,
  cssHeight: number,
): { ctx: CanvasRenderingContext2D; width: number; height: number } | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssWidth = canvas.clientWidth || 640;
  const pw = Math.round(cssWidth * dpr);
  const ph = Math.round(cssHeight * dpr);
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw;
    canvas.height = ph;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width: cssWidth, height: cssHeight };
}
