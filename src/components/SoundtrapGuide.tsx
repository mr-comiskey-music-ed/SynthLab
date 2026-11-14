import React, { useId } from 'react';
import { MiniSoundtrapPanel } from './SoundtrapView';
import type { GuideDef } from './ModeGuide';
import { SoundtrapPatch, GUIDE_BASE, ST_STEPS, StFlow, NAME_MAP, STARTING_POINTS, soundtrapProgress } from '../utils/soundtrap';

const CAPTIONS: Record<StFlow, string> = {
  osc: 'Oscillators make the raw tone',
  hpf: 'HPF cuts the lows',
  filter: 'Filter cuts the highs',
  amp: 'Amp sets the loudness',
  chorus: 'Chorus widens it',
  env: 'One envelope moves the filter and the amp',
  lfo: 'LFO wobbles pitch, pulse width and cutoff',
};

/** Soundtrap's signal path: one envelope with two arrows (filter and amp) is the big difference from SynthLab. */
const SoundtrapFlow: React.FC<{ lit: string[] }> = ({ lit }) => {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const mk = { flow: `st-flow-${uid}`, on: `st-on-${uid}`, off: `st-off-${uid}` };
  const on = (p: StFlow) => lit.includes(p);
  const FONT = "'Barlow Semi Condensed', 'Barlow', system-ui, sans-serif";
  const Block: React.FC<{ part: StFlow; x: number; y: number; w: number; h: number; label: string }> = ({ part, x, y, w, h, label }) => {
    const c = on(part)
      ? { fill: '#fbbf24', stroke: '#fde68a', text: '#111827' }
      : { fill: 'rgba(0,0,0,0.4)', stroke: 'rgba(255,255,255,0.14)', text: '#94a3b8' };
    return (
      <g style={on(part) ? { filter: 'drop-shadow(0 0 5px rgba(251,191,36,0.6))' } : undefined}>
        <rect x={x} y={y} width={w} height={h} rx={7} fill={c.fill} stroke={c.stroke} strokeWidth={1.5} />
        <text x={x + w / 2} y={y + h / 2 + 4} textAnchor="middle" fontSize={12} fontWeight={700} fill={c.text} fontFamily={FONT} letterSpacing="0.05em">
          {label}
        </text>
      </g>
    );
  };
  const mod = (p: StFlow) => (on(p) ? '#22d3ee' : 'rgba(148,163,184,0.45)');
  const sound = 'rgba(203,213,225,0.7)';
  const arrow = (p: StFlow) => `url(#${on(p) ? mk.on : mk.off})`;

  return (
    <div className="w-full md:flex-1 md:max-w-[46rem] min-w-0" aria-label="Soundtrap signal path">
      <svg viewBox="0 0 700 100" className="w-full h-auto block" role="img" aria-label="Oscillators go through the HPF, filter, amp and chorus to the speaker; one envelope moves both the filter and the amp, and the LFO moves pitch, pulse width and cutoff">
        <defs>
          <marker id={mk.flow} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0 L8 4 L0 8 z" fill={sound} />
          </marker>
          <marker id={mk.on} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0 L8 4 L0 8 z" fill="#22d3ee" />
          </marker>
          <marker id={mk.off} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0 L8 4 L0 8 z" fill="rgba(148,163,184,0.6)" />
          </marker>
        </defs>

        <Block part="osc" x={0} y={14} w={128} h={30} label="OSCILLATORS" />
        <path d="M128 29 H158" stroke={sound} strokeWidth={1.5} markerEnd={`url(#${mk.flow})`} />
        <Block part="hpf" x={162} y={14} w={70} h={30} label="HPF" />
        <path d="M232 29 H262" stroke={sound} strokeWidth={1.5} markerEnd={`url(#${mk.flow})`} />
        <Block part="filter" x={266} y={14} w={100} h={30} label="FILTER" />
        <path d="M366 29 H396" stroke={sound} strokeWidth={1.5} markerEnd={`url(#${mk.flow})`} />
        <Block part="amp" x={400} y={14} w={86} h={30} label="AMP" />
        <path d="M486 29 H516" stroke={sound} strokeWidth={1.5} markerEnd={`url(#${mk.flow})`} />
        <Block part="chorus" x={520} y={14} w={100} h={30} label="CHORUS" />
        <path d="M620 29 H648" stroke={sound} strokeWidth={1.5} markerEnd={`url(#${mk.flow})`} />
        <text x={672} y={37} textAnchor="middle" fontSize={24}>🔊</text>

        <Block part="lfo" x={0} y={74} w={128} h={24} label="LFO" />
        <path d="M40 74 V46" fill="none" stroke={mod('lfo')} strokeWidth={1.75} strokeDasharray="4 3" markerEnd={arrow('lfo')} />
        <text x={46} y={62} fontSize={10} fill={mod('lfo')} fontFamily={FONT}>pitch · PWM</text>
        <path d="M120 74 V64 H300 V46" fill="none" stroke={mod('lfo')} strokeWidth={1.75} strokeDasharray="4 3" markerEnd={arrow('lfo')} />
        <text x={160} y={60} fontSize={10} fill={mod('lfo')} fontFamily={FONT}>cutoff</text>

        {/* One envelope, two jobs */}
        <Block part="env" x={318} y={74} w={150} h={24} label="ENVELOPE" />
        <path d="M340 74 V46" fill="none" stroke={mod('env')} strokeWidth={1.75} strokeDasharray="4 3" markerEnd={arrow('env')} />
        <text x={346} y={62} fontSize={10} fill={mod('env')} fontFamily={FONT}>cutoff</text>
        <path d="M446 74 V46" fill="none" stroke={mod('env')} strokeWidth={1.75} strokeDasharray="4 3" markerEnd={arrow('env')} />
        <text x={452} y={62} fontSize={10} fill={mod('env')} fontFamily={FONT}>volume</text>
      </svg>
    </div>
  );
};


/** The Soundtrap Synth Guide: an optional, ungraded bridge from SynthLab to Soundtrap's Juno-106 style synth. */
export const SOUNDTRAP_GUIDE: GuideDef<SoundtrapPatch> = {
  id: 'soundtrap',
  label: 'Soundtrap guide',
  synthName: 'the Soundtrap synth',
  appName: 'Soundtrap',
  base: GUIDE_BASE,
  steps: ST_STEPS,
  nameMap: NAME_MAP,
  theirsHeading: 'In Soundtrap',
  startingPoints: STARTING_POINTS,
  progress: soundtrapProgress,
  captions: CAPTIONS,
  Flow: SoundtrapFlow,
  Mini: MiniSoundtrapPanel,
  complete: {
    title: 'You can find your way around the Soundtrap synth.',
    blurb:
      'Same ideas, new panel: one oscillator with waves to mix, two filters, one envelope doing two jobs, and an LFO you send wherever you want it. Below are a few starting points if you want one.',
  },
};
