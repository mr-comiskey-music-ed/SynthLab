import React from 'react';
import { SynthParams } from '../types';

/**
 * Small pulsing "~ LFO" tag for the oscillator header while the LFO is sent to Pitch (vibrato).
 * Pitch has no knob of its own to light up, so this tells students the oscillators are being moved.
 * It pulses at the LFO's rate, slowed to at most ~2.5 flashes a second so it never strobes.
 */
export const LfoPitchBadge: React.FC<{ params: SynthParams; tone?: 'dark' | 'light' }> = ({ params, tone = 'dark' }) => {
  if (params.lfoDestination !== 'pitch' || params.lfoDepth <= 0) return null;
  const seconds = Math.max(0.4, 1 / Math.max(0.1, params.lfoRate));
  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 rounded-full border text-[10px] font-mono font-bold animate-pulse ${
        tone === 'light'
          ? 'text-cyan-700 bg-cyan-100 border-cyan-400'
          : 'text-cyan-300 bg-cyan-500/10 border-cyan-400/50'
      }`}
      style={{ animationDuration: `${seconds}s` }}
      title="The LFO is sending vibrato to the pitch of both oscillators"
    >
      <span aria-hidden="true" className="text-xs leading-none">~</span> LFO
    </span>
  );
};
