/**
 * Readout for the VCO 1 / VCO 2 crossfade knob. The knob runs -1 to +1: at 0 both
 * oscillators play at full level; turning left fades VCO 2 out, right fades VCO 1 out.
 */
export const balanceText = (v: number): string =>
  Math.abs(v) < 0.03 ? 'Both full' : v <= -0.97 ? 'VCO 1 only' : v >= 0.97 ? 'VCO 2 only' : v < 0 ? `VCO 2 -${Math.round(-v * 100)}%` : `VCO 1 -${Math.round(v * 100)}%`;
