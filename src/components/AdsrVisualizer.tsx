import React, { useState, useEffect, useRef } from 'react';
import { SubtractiveEngine } from '../audio/synthEngine';
import { Maximize2, Minimize2 } from 'lucide-react';

interface AdsrVisualizerProps {
  attack: number; // in seconds (e.g. 0.001 to 2.0)
  decay: number; // in seconds (e.g. 0.01 to 2.0)
  sustain: number; // normalized 0 to 1
  release: number; // in seconds (e.g. 0.01 to 3.0)
  height?: number;
  width?: number;
  showLabels?: boolean;
  className?: string;
  theme?: 'studio-retro' | 'hardware-bench' | 'diagram';
  engine?: SubtractiveEngine;
}

export const AdsrVisualizer: React.FC<AdsrVisualizerProps> = ({
  attack,
  decay,
  sustain,
  release,
  height = 180,
  width = 380,
  showLabels = true,
  className = '',
  theme = 'diagram',
  engine,
}) => {
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Dark themes need light axis/label ink; the light diagram theme keeps dark ink.
  const dark = theme !== 'diagram';
  const ink = dark ? '#cbd5e1' : '#0f172a';
  const zoneColors = dark
    ? { a: '#6ee7b7', aSub: '#34d399', d: '#fdba74', dSub: '#fb923c', r: '#f9a8d4', rSub: '#f472b6' }
    : { a: '#065f46', aSub: '#047857', d: '#9a3412', dSub: '#c2410c', r: '#831843', rSub: '#9d174d' };

  // SVG Dimensions & Margins
  const svgWidth = 400;
  const svgHeight = 200;

  const paddingLeft = 36;
  const paddingRight = 24;
  const paddingTop = 24;
  const paddingBottom = 34;

  const plotWidth = svgWidth - paddingLeft - paddingRight;
  const plotHeight = svgHeight - paddingTop - paddingBottom;

  // Clamped proportional widths for the 4 zones
  const rawA = Math.max(0.005, Math.min(2.0, attack));
  const rawD = Math.max(0.01, Math.min(2.0, decay));
  const rawS = Math.max(0.0, Math.min(1.0, sustain));
  const rawR = Math.max(0.01, Math.min(3.0, release));

  // Map to visual proportional fractions
  const minW = 22;
  const weightA = Math.pow(rawA, 0.5);
  const weightD = Math.pow(rawD, 0.5);
  const weightS = 1.35; // Fixed reasonable sustain plateau width for representation
  const weightR = Math.pow(rawR, 0.5);

  const totalWeight = weightA + weightD + weightS + weightR;
  const widthA = Math.max(minW, (weightA / totalWeight) * plotWidth);
  const widthD = Math.max(minW, (weightD / totalWeight) * plotWidth);
  const widthR = Math.max(minW, (weightR / totalWeight) * plotWidth);
  const widthS = plotWidth - widthA - widthD - widthR;

  // X Coordinates of zone boundaries
  const x0 = paddingLeft;
  const xA = x0 + widthA;
  const xD = xA + widthD;
  const xS = xD + widthS;
  const xR = xS + widthR;

  // Y Coordinates
  const yPeak = paddingTop;
  const yZero = paddingTop + plotHeight;
  const ySustain = yZero - rawS * plotHeight;

  // SVG Path for the ADSR curve:
  const curvePath = `
    M ${x0} ${yZero}
    L ${xA} ${yPeak}
    C ${xA + widthD * 0.35} ${yPeak + (ySustain - yPeak) * 0.75}, ${xA + widthD * 0.7} ${ySustain}, ${xD} ${ySustain}
    L ${xS} ${ySustain}
    C ${xS + widthR * 0.35} ${ySustain + (yZero - ySustain) * 0.65}, ${xS + widthR * 0.7} ${yZero}, ${xR} ${yZero}
  `;

  // Filled area under the curve
  const areaPath = `
    M ${x0} ${yZero}
    L ${xA} ${yPeak}
    C ${xA + widthD * 0.35} ${yPeak + (ySustain - yPeak) * 0.75}, ${xA + widthD * 0.7} ${ySustain}, ${xD} ${ySustain}
    L ${xS} ${ySustain}
    C ${xS + widthR * 0.35} ${ySustain + (yZero - ySustain) * 0.65}, ${xS + widthR * 0.7} ${yZero}, ${xR} ${yZero}
    L ${x0} ${yZero}
    Z
  `;

  // Real-time animation dot state tracking the envelope motion when played
  const [dot, setDot] = useState<{
    active: boolean;
    x: number;
    y: number;
    level: number;
    stage: 'idle' | 'attack' | 'decay' | 'sustain' | 'release';
  }>({
    active: false,
    x: x0,
    y: yZero,
    level: 0,
    stage: 'idle',
  });

  const isHeldRef = useRef(false);
  const pressTimeRef = useRef<number | null>(null);
  const releaseTimeRef = useRef<number | null>(null);
  const releaseLevelRef = useRef(0);
  const currentLevelRef = useRef(0);
  const animIdRef = useRef<number | null>(null);

  // Helper to start the animation loop
  const runAnimLoop = () => {
    if (animIdRef.current !== null) return;

    const tick = () => {
      const now = performance.now();
      const isHeld = isHeldRef.current;
      const pressTime = pressTimeRef.current;
      const releaseTime = releaseTimeRef.current;

      const aSec = Math.max(0.005, rawA);
      const dSec = Math.max(0.01, rawD);
      const sLvl = rawS;
      const rSec = Math.max(0.01, rawR);

      let currentX = x0;
      let currentY = yZero;
      let currentLevel = 0;
      let stage: 'idle' | 'attack' | 'decay' | 'sustain' | 'release' = 'idle';
      let keepGoing = false;

      if (isHeld && pressTime !== null) {
        const elapsedSec = (now - pressTime) / 1000;
        keepGoing = true;

        if (elapsedSec < aSec) {
          const p = Math.min(1.0, elapsedSec / aSec);
          currentX = x0 + p * (xA - x0);
          currentY = yZero - p * (yZero - yPeak);
          currentLevel = p;
          stage = 'attack';
        } else if (elapsedSec < aSec + dSec) {
          const p = Math.min(1.0, (elapsedSec - aSec) / dSec);
          currentX = xA + p * (xD - xA);
          currentY = yPeak + p * (ySustain - yPeak);
          currentLevel = 1.0 - p * (1.0 - sLvl);
          stage = 'decay';
        } else {
          currentX = xD + Math.min(1.0, (elapsedSec - aSec - dSec) / 0.5) * (xS - xD);
          currentY = ySustain;
          currentLevel = sLvl;
          stage = 'sustain';
        }
      } else if (!isHeld && releaseTime !== null) {
        const releaseElapsed = (now - releaseTime) / 1000;
        keepGoing = true;

        if (releaseElapsed < rSec) {
          const p = Math.min(1.0, releaseElapsed / rSec);
          currentX = xS + p * (xR - xS);
          currentY = ySustain + p * (yZero - ySustain);
          currentLevel = releaseLevelRef.current * (1.0 - p);
          stage = 'release';
        } else {
          currentX = xR;
          currentY = yZero;
          currentLevel = 0;
          stage = 'idle';
          keepGoing = false;
          animIdRef.current = null;
        }
      }

      currentLevelRef.current = currentLevel;
      setDot({
        active: stage !== 'idle',
        x: currentX,
        y: currentY,
        level: currentLevel,
        stage,
      });

      if (keepGoing) {
        animIdRef.current = requestAnimationFrame(tick);
      } else {
        animIdRef.current = null;
      }
    };

    animIdRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    if (!engine) return;

    const unsubscribe = engine.subscribeEnvelope((isHeld: boolean) => {
      const now = performance.now();
      if (isHeld) {
        isHeldRef.current = true;
        pressTimeRef.current = now;
        releaseTimeRef.current = null;
        runAnimLoop();
      } else {
        isHeldRef.current = false;
        releaseTimeRef.current = now;
        releaseLevelRef.current = currentLevelRef.current;
        runAnimLoop();
      }
    });

    return () => {
      unsubscribe();
      if (animIdRef.current !== null) {
        cancelAnimationFrame(animIdRef.current);
        animIdRef.current = null;
      }
    };
  }, [engine, rawA, rawD, rawS, rawR]);

  // Handle clicking on the diagram to test / audition the envelope
  const handleAuditionClick = () => {
    if (engine) {
      engine.noteOn('C4', 0.85);
      setTimeout(() => {
        engine.noteOff('C4');
      }, 750);
    }
  };

  const isPeak = dot.level >= 0.85;

  const containerClasses = isFullScreen
    ? "fixed inset-4 md:inset-12 z-50 flex flex-col p-6 bg-slate-950 border-2 border-amber-500 shadow-2xl rounded-2xl"
    : `relative rounded-xl overflow-hidden select-none border transition-all ${
        theme === 'hardware-bench'
          ? 'bg-[#181d22] border-[#374151]'
          : theme === 'studio-retro'
          ? 'bg-[#0e1117] border-amber-500/30'
          : 'bg-[#fcfdfa] border-slate-300 shadow-md'
      } ${className}`;

  return (
    <>
      {isFullScreen && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40" 
          onClick={() => setIsFullScreen(false)} 
        />
      )}
      <div
        id="adsr-diagram-container"
        className={containerClasses}
        onDoubleClick={() => setIsFullScreen(!isFullScreen)}
        title="Double-click to toggle full screen"
      >
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto block cursor-pointer flex-1"
          style={{ maxHeight: isFullScreen ? '550px' : `${height}px` }}
          onClick={handleAuditionClick}
          title="Click to audition ADSR Envelope with moving dot"
        >
          <defs>
            <marker
              id="axis-arrow-y"
              viewBox="0 0 10 10"
              refX="5"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill={ink} />
            </marker>
            <marker
              id="axis-arrow-x"
              viewBox="0 0 10 10"
              refX="5"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M 0 10 L 5 0 L 10 10 z" fill={ink} />
            </marker>

            {/* ADSR Curve Stroke Gradient */}
            <linearGradient id="adsr-curve-stroke" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor={theme === 'diagram' ? '#0f172a' : '#fbbf24'} />
              <stop offset="100%" stopColor={theme === 'diagram' ? '#0f172a' : '#fbbf24'} />
            </linearGradient>

            {/* Area gradient under curve */}
            <linearGradient id="adsr-curve-fill" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={theme === 'studio-retro' ? '#f59e0b' : '#0284c7'} stopOpacity={dark ? 0.12 : 0.02} />
              <stop offset="100%" stopColor={theme === 'studio-retro' ? '#f59e0b' : '#0284c7'} stopOpacity={dark ? 0.75 : 0.15} />
            </linearGradient>
          </defs>

          {/* 1. FILLED AREA UNDER CURVE */}
          <path
            d={areaPath}
            fill="url(#adsr-curve-fill)"
            fillOpacity={theme === 'diagram' ? '0.85' : '0.6'}
          />

          {/* 2. VERTICAL DASHED DIVIDING LINES */}
          <line
            x1={xA}
            y1={yPeak}
            x2={xA}
            y2={yZero}
            stroke={dark ? '#e2e8f0' : '#94a3b8'}
            strokeWidth="1"
            strokeDasharray="2 2"
            opacity={dark ? 0.4 : 0.5}
          />
          <line
            x1={xD}
            y1={ySustain}
            x2={xD}
            y2={yZero}
            stroke={dark ? '#e2e8f0' : '#94a3b8'}
            strokeWidth="1"
            strokeDasharray="2 2"
            opacity={dark ? 0.4 : 0.5}
          />
          <line
            x1={xS}
            y1={ySustain}
            x2={xS}
            y2={yZero}
            stroke={dark ? '#e2e8f0' : '#94a3b8'}
            strokeWidth="1"
            strokeDasharray="2 2"
            opacity={dark ? 0.4 : 0.5}
          />

          {/* Sustain Level Horizontal Guideline */}
          <line
            x1={xD}
            y1={ySustain}
            x2={xS}
            y2={ySustain}
            stroke={dark ? '#fde68a' : '#0284c7'}
            strokeWidth="1.25"
            strokeDasharray="3 3"
            opacity={dark ? 0.85 : 0.65}
          />

          {/* 3. SOLID ADSR ENVELOPE CURVE */}
          <path
            d={curvePath}
            fill="none"
            stroke="url(#adsr-curve-stroke)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* 4. PHASE ANCHOR POINTS (A, D, S, R key nodes) */}
          <circle cx={x0} cy={yZero} r="3" fill={ink} />
          <circle cx={xA} cy={yPeak} r="4" fill={ink} />
          <circle cx={xD} cy={ySustain} r="3.5" fill={ink} />
          <circle cx={xS} cy={ySustain} r="3.5" fill={ink} />
          <circle cx={xR} cy={yZero} r="3" fill={ink} />

          {/* 5. AXES & LABELS */}
          {/* Y Axis (Amplitude Level) */}
          <line
            x1={x0}
            y1={svgHeight - paddingBottom}
            x2={x0}
            y2={paddingTop - 10}
            stroke={ink}
            strokeWidth="2"
            markerEnd="url(#axis-arrow-y)"
          />
          {/* Level 100% Text Label along Y Axis */}
          <text
            x={x0 - 8}
            y={paddingTop + 45}
            textAnchor="middle"
            transform={`rotate(-90 ${x0 - 8} ${paddingTop + 45})`}
            fontSize="13"
            fontStyle="italic"
            fontWeight="500"
            fontFamily="'Barlow', system-ui, sans-serif"
            fill={ink}
          >
            Level 100%
          </text>

          {/* X Axis (Time) */}
          <line
            x1={x0}
            y1={yZero}
            x2={svgWidth - 6}
            y2={yZero}
            stroke={ink}
            strokeWidth="2"
            markerEnd="url(#axis-arrow-x)"
          />
          {/* Time Text Label along X Axis */}
          <text
            x={svgWidth - 14}
            y={yZero + 18}
            textAnchor="end"
            fontSize="13"
            fontStyle="italic"
            fontWeight="500"
            fontFamily="'Barlow', system-ui, sans-serif"
            fill={ink}
          >
            Time
          </text>

          {/* 6. ZONE LABELS AT THE BOTTOM */}
          {showLabels && (
            <g fontSize="12" fontWeight="600" fontFamily="'Barlow', system-ui, sans-serif">
              {/* Attack Label */}
              <text x={x0 + widthA / 2} y={yZero + 16} textAnchor="middle" fill={zoneColors.a}>
                Attack
              </text>
              <text x={x0 + widthA / 2} y={yZero + 28} textAnchor="middle" fontSize="10.5" fill={zoneColors.aSub} opacity="0.95">
                {rawA >= 1 ? `${rawA.toFixed(2)}s` : `${Math.round(rawA * 1000)}ms`}
              </text>

              {/* Decay Label */}
              <text x={xA + widthD / 2} y={yZero + 16} textAnchor="middle" fill={zoneColors.d}>
                Decay
              </text>
              <text x={xA + widthD / 2} y={yZero + 28} textAnchor="middle" fontSize="10.5" fill={zoneColors.dSub} opacity="0.95">
                {rawD >= 1 ? `${rawD.toFixed(2)}s` : `${Math.round(rawD * 1000)}ms`}
              </text>

              {/* Release Label */}
              <text x={xS + widthR / 2} y={yZero + 16} textAnchor="middle" fill={zoneColors.r}>
                Release
              </text>
              <text x={xS + widthR / 2} y={yZero + 28} textAnchor="middle" fontSize="10.5" fill={zoneColors.rSub} opacity="0.95">
                {rawR >= 1 ? `${rawR.toFixed(2)}s` : `${Math.round(rawR * 1000)}ms`}
              </text>
            </g>
          )}

          {/* 7. ANIMATED ENVELOPE TRACKING DOT */}
          {dot.active && (
            <g>
              <circle
                cx={dot.x}
                cy={dot.y}
                r={isPeak ? 13 : 9}
                fill="none"
                stroke={isPeak ? '#ef4444' : theme === 'diagram' ? '#0284c7' : '#f59e0b'}
                strokeWidth="2.5"
                className="animate-ping opacity-75"
                style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
              />
              <circle
                cx={dot.x}
                cy={dot.y}
                r={isPeak ? 9 : 7}
                fill={isPeak ? '#ef4444' : theme === 'diagram' ? '#0284c7' : '#f59e0b'}
                opacity="0.45"
              />
              <circle
                cx={dot.x}
                cy={dot.y}
                r={isPeak ? 6.5 : 5.5}
                fill={isPeak ? '#dc2626' : theme === 'diagram' ? '#0284c7' : '#fbbf24'}
                stroke="#ffffff"
                strokeWidth="2"
                style={{
                  filter: isPeak ? 'drop-shadow(0 0 8px #ef4444)' : 'drop-shadow(0 0 5px #0284c7)',
                }}
              />

              <g transform={`translate(${Math.min(svgWidth - 70, Math.max(x0, dot.x - 30))}, ${Math.max(12, dot.y - 17)})`}>
                <rect
                  x="0"
                  y="0"
                  width="60"
                  height="15"
                  rx="3.5"
                  fill={isPeak ? '#991b1b' : '#0f172a'}
                  opacity="0.92"
                  stroke={isPeak ? '#f87171' : '#38bdf8'}
                  strokeWidth="1"
                />
                <text
                  x="30"
                  y="11"
                  textAnchor="middle"
                  fontSize="8"
                  fontWeight="bold"
                  fontFamily="'Barlow Semi Condensed', system-ui, sans-serif"
                  fill="#ffffff"
                >
                  {dot.stage.toUpperCase()} {Math.round(dot.level * 100)}%
                </text>
              </g>
            </g>
          )}
        </svg>

        {/* Fullscreen Toggle Button at Top Right */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setIsFullScreen(!isFullScreen); }}
          className="absolute top-2 right-2.5 z-10 p-1 rounded bg-black/70 hover:bg-amber-500 hover:text-black text-amber-400 border border-amber-800/60 shadow transition-colors"
          title={isFullScreen ? "Exit Full Screen" : "Expand to Full Screen"}
        >
          {isFullScreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
        </button>
      </div>
    </>
  );
};
