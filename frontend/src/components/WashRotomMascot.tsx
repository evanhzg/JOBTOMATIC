import React from 'react';

interface WashRotomMascotProps {
  className?: string;
  size?: number;
}

/**
 * Modern Brand Emblem for JOBTOMATIC.
 * Retains the Motisma (Rotom) electric appliance concept (lightning nexus,
 * appliance chassis, rotary wash aperture) stylized as a sleek, geometric tech brand logo.
 */
export const WashRotomMascot: React.FC<WashRotomMascotProps> = ({ 
  className = "", 
  size = 36 
}) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
    >
      {/* Outer Diamond / Hexagonal Electric Plasma Shield (Sharp Geometry) */}
      <polygon 
        points="50,4 88,28 88,72 50,96 12,72 12,28" 
        fill="#18181B" 
        stroke="#5F7A48" 
        strokeWidth="3" 
        strokeLinejoin="miter"
      />

      {/* Lightning Spark Apex (Motisma Plasma Antenna) */}
      <polygon 
        points="50,9 56,22 48,22 54,34 44,22 50,22" 
        fill="#5F7A48" 
      />

      {/* Appliance Body: Crisp Inset Square Chassis */}
      <rect 
        x="28" 
        y="30" 
        width="44" 
        height="46" 
        fill="#27272A" 
        stroke="#FFFFFF" 
        strokeWidth="2" 
      />

      {/* Top Appliance Control Ribbon */}
      <line x1="28" y1="40" x2="72" y2="40" stroke="#5F7A48" strokeWidth="2" />
      {/* Micro Status LEDs */}
      <circle cx="34" cy="35" r="1.5" fill="#5F7A48" />
      <circle cx="39" cy="35" r="1.5" fill="#A1A1AA" />
      <rect x="58" y="34" width="8" height="2" fill="#5F7A48" />

      {/* Rotary Washer Drum & Kinetic Vortex (Rotom Eye / Aperture) */}
      <circle 
        cx="50" 
        cy="56" 
        r="14" 
        fill="#18181B" 
        stroke="#5F7A48" 
        strokeWidth="2.5" 
      />

      {/* Dynamic Electric Wave Blades inside Aperture */}
      <path 
        d="M44 56 C 44 51, 56 51, 56 56 C 56 61, 44 61, 44 56 Z" 
        stroke="#FFFFFF" 
        strokeWidth="1.8" 
        fill="#5F7A48"
      />
      <circle cx="50" cy="56" r="2.5" fill="#FFFFFF" />

      {/* Dual Electric Energy Discharge Ports (Side Hose Jets) */}
      <line x1="22" y1="52" x2="28" y2="52" stroke="#5F7A48" strokeWidth="2.5" strokeLinecap="square" />
      <line x1="72" y1="52" x2="78" y2="52" stroke="#5F7A48" strokeWidth="2.5" strokeLinecap="square" />
      <rect x="18" y="50" width="4" height="4" fill="#FFFFFF" />
      <rect x="78" y="50" width="4" height="4" fill="#FFFFFF" />
    </svg>
  );
};
