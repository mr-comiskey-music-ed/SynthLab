import React from 'react';

interface SynthLabLogoProps {
  className?: string;
  size?: number;
}

/**
 * SynthLab mark: a Modern Synth panel (silver face, walnut side cheeks)
 * with an ADSR envelope and an amber LED on the attack peak.
 * Same artwork as public/favicon.svg.
 */
export const SynthLabLogo: React.FC<SynthLabLogoProps> = ({ className = '', size = 32 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="Subtractive Synthesis Lab"
    className={`shrink-0 ${className}`}
  >
    <defs>
      <clipPath id="synthlab-logo-clip">
        <rect width="64" height="64" rx="14" />
      </clipPath>
    </defs>
    <g clipPath="url(#synthlab-logo-clip)">
      <rect width="64" height="64" fill="#c8cfd8" />
      <rect width="6" height="64" fill="#4a2810" />
      <rect x="58" width="6" height="64" fill="#4a2810" />
    </g>
    <path
      d="M13 49 L25 15 L33 31 H41 L51 49"
      fill="none"
      stroke="#1e293b"
      strokeWidth="6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="25" cy="15" r="5" fill="#f59e0b" stroke="#1e293b" strokeWidth="2" />
  </svg>
);
