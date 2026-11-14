import React, { useId } from 'react';
import { MiniRetroPanel } from './RetroView';
import type { GuideDef } from './ModeGuide';
import { RetroPatch, RETRO_BASE, RS_STEPS, RsFlow, RETRO_NAME_MAP, RETRO_STARTING_POINTS, retroProgress } from '../utils/retroSynth';

const CAPTIONS: Record<RsFlow, string> = {
  osc: 'Two oscillators make the raw tone',
  filter: 'Filter shapes the brightness',
  amp: 'Amp sets the loudness',
  effect: 'Effect widens or sweeps it',
  sine: 'Sine Level adds a pure tone after the filter',
  filterEnv: 'Filter Env moves the cutoff',
  ampEnv: 'Amp Env shapes the volume',
  lfo: 'LFO moves the cutoff and the shape',
  vibrato: 'Vibrato moves the pitch',
};

/** Retro Synth's signal path: two envelopes like SynthLab, two LFOs, and Sine Level joining after the filter. */
const RetroFlow: React.FC<{ lit: string[] }> = ({ lit }) => {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const mk = { flow: `rs-flow-${uid}`, on: `rs-on-${uid}`, off: `rs-off-${uid}` };
  const on = (p: RsFlow) => lit.includes(p);
  const FONT = "'Barlow Semi Condensed', 'Barlow', system-ui, sans-serif";
  const Block: React.FC<{ part: RsFlow; x: number; y: number; w: number; h: number; label: string; size?: number }> = ({ part, x, y, w, h, label, size = 12 }) => {
    const c = on(part)
      ? { fill: '#fbbf24', stroke: '#fde68a', text: '#111827' }
      : { fill: 'rgba(0,0,0,0.4)', stroke: 'rgba(255,255,255,0.14)', text: '#94a3b8' };
    return (
      <g style={on(part) ? { filter: 'drop-shadow(0 0 5px rgba(251,191,36,0.6))' } : undefined}>
        <rect x={x} y={y} width={w} height={h} rx={7} fill={c.fill} stroke={c.stroke} strokeWidth={1.5} />
        <text x={x + w / 2} y={y + h / 2 + size / 3} textAnchor="middle" fontSize={size} fontWeight={700} fill={c.text} fontFamily={FONT} letterSpacing="0.05em">
          {label}
        </text>
      </g>
    );
  };
  const mod = (p: RsFlow) => (on(p) ? '#22d3ee' : 'rgba(148,163,184,0.45)');
  const sound = 'rgba(203,213,225,0.7)';
  const arrow = (p: RsFlow) => `url(#${on(p) ? mk.on : mk.off})`;
  const label = (x: number, y: number, p: RsFlow, t: string) => (
    <text x={x} y={y} fontSize={10} fill={mod(p)} fontFamily={FONT}>
      {t}
    </text>
  );

  return (
    <div className="w-full md:flex-1 md:max-w-[46rem] min-w-0" aria-label="Retro Synth signal path">
      <svg
        viewBox="0 0 700 100"
        className="w-full h-auto block"
        role="img"
        aria-label="Two oscillators go through the filter, amp and effect to the speaker; Sine Level joins after the filter; Filter Env moves the cutoff and Amp Env the volume; the LFO moves the cutoff and shape, and Vibrato moves the pitch"
      >
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
        <Block part="filter" x={162} y={14} w={110} h={30} label="FILTER" />
        <path d="M272 29 H302" stroke={sound} strokeWidth={1.5} markerEnd={`url(#${mk.flow})`} />
        <Block part="amp" x={306} y={14} w={86} h={30} label="AMP" />
        <path d="M392 29 H422" stroke={sound} strokeWidth={1.5} markerEnd={`url(#${mk.flow})`} />
        <Block part="effect" x={426} y={14} w={100} h={30} label="EFFECT" />
        <path d="M526 29 H556" stroke={sound} strokeWidth={1.5} markerEnd={`url(#${mk.flow})`} />
        <text x={580} y={37} textAnchor="middle" fontSize={24}>🔊</text>

        {/* Two LFOs */}
        <Block part="vibrato" x={0} y={74} w={58} h={24} label="VIBRATO" size={10} />
        <path d="M29 74 V46" fill="none" stroke={mod('vibrato')} strokeWidth={1.75} strokeDasharray="4 3" markerEnd={arrow('vibrato')} />
        {label(33, 62, 'vibrato', 'pitch')}
        <Block part="lfo" x={64} y={74} w={62} h={24} label="LFO" />
        <path d="M100 74 V46" fill="none" stroke={mod('lfo')} strokeWidth={1.75} strokeDasharray="4 3" markerEnd={arrow('lfo')} />
        {label(104, 62, 'lfo', 'shape')}
        <path d="M126 86 H190 V46" fill="none" stroke={mod('lfo')} strokeWidth={1.75} strokeDasharray="4 3" markerEnd={arrow('lfo')} />
        {label(140, 81, 'lfo', 'cutoff')}

        {/* Two envelopes, like SynthLab */}
        <Block part="filterEnv" x={206} y={74} w={90} h={24} label="FILTER ENV" size={11} />
        <path d="M251 74 V46" fill="none" stroke={mod('filterEnv')} strokeWidth={1.75} strokeDasharray="4 3" markerEnd={arrow('filterEnv')} />
        {label(214, 62, 'filterEnv', 'cutoff')}
        <Block part="sine" x={300} y={74} w={50} h={24} label="SINE" size={11} />
        <path d="M325 74 V46" fill="none" stroke={on('sine') ? '#fde68a' : sound} strokeWidth={1.5} markerEnd={`url(#${mk.flow})`} />
        <Block part="ampEnv" x={356} y={74} w={84} h={24} label="AMP ENV" size={11} />
        <path d="M378 74 V46" fill="none" stroke={mod('ampEnv')} strokeWidth={1.75} strokeDasharray="4 3" markerEnd={arrow('ampEnv')} />
        {label(384, 62, 'ampEnv', 'volume')}
      </svg>
    </div>
  );
};

/** The Retro Synth Guide: an optional, ungraded bridge from SynthLab to Logic Pro's Retro Synth. */
export const RETRO_GUIDE: GuideDef<RetroPatch> = {
  id: 'retro',
  label: 'Retro Synth guide',
  synthName: 'Logic’s Retro Synth',
  appName: 'Logic',
  base: RETRO_BASE,
  steps: RS_STEPS,
  nameMap: RETRO_NAME_MAP,
  theirsHeading: 'In Retro Synth',
  startingPoints: RETRO_STARTING_POINTS,
  progress: retroProgress,
  captions: CAPTIONS,
  Flow: RetroFlow,
  Mini: MiniRetroPanel,
  complete: {
    title: 'You can find your way around Retro Synth.',
    blurb:
      'Same ideas, new panel: two oscillators with a Mix slider, a filter with two envelopes like SynthLab, two LFOs, plus Sine Level, an effect and Glide. Below are a few starting points if you want one.',
  },
};
