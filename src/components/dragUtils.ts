import type React from 'react';

/** Mouse or touch drag. Touch that starts here never scrolls the page. */
export function startDrag(e: React.MouseEvent | React.TouchEvent, onMove: (x: number, y: number, x0: number, y0: number) => void) {
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
