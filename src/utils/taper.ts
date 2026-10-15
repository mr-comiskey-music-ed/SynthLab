/**
 * Curved ("tapered") control travel for time settings like envelope Attack/Decay/Release.
 *
 * A linear knob from 1 ms to 3 s spends almost all of its turn on long times, so the
 * musically busy range (0-200 ms) is crammed into the first sliver. This power curve
 * puts `center` exactly at the middle of the travel (12 o'clock on a knob, halfway up
 * a fader) and spreads the short times out.
 *
 *   value = min + (max - min) * position^k,   with k chosen so position 0.5 -> center
 */
function exponent(min: number, max: number, center: number): number {
  const c = Math.min(Math.max(center, min + 1e-6), max - 1e-6);
  return Math.log((max - min) / (c - min)) / Math.log(2);
}

/** Control position (0..1) -> value. */
export function taperValue(position: number, min: number, max: number, center: number): number {
  const p = Math.max(0, Math.min(1, position));
  return min + (max - min) * Math.pow(p, exponent(min, max, center));
}

/** Value -> control position (0..1). */
export function taperPosition(value: number, min: number, max: number, center: number): number {
  const ratio = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return Math.pow(ratio, 1 / exponent(min, max, center));
}

/** Time value shown at 12 o'clock on envelope time controls. */
export const ENVELOPE_CENTER_SECONDS = 0.5;
