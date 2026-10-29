import React from 'react';

interface WashRotomMascotProps {
  className?: string;
  size?: number;
}

export const WashRotomMascot: React.FC<WashRotomMascotProps> = ({ 
  className = "", 
  size = 40 
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
      {/* Outer sketchy electric/water aura aura - Hand drawn scribble style */}
      <path 
        d="M20 28 C 10 35, 8 55, 14 70 C 18 80, 30 92, 50 94 C 70 95, 85 82, 88 68 C 92 52, 88 32, 78 24 C 65 15, 35 18, 20 28 Z" 
        stroke="#C5EA4B" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeDasharray="95 4"
        fill="rgba(197, 234, 75, 0.08)"
      />

      {/* Lightning Plasma Spike on Top of Head (Motisma Antenna) */}
      <path 
        d="M48 24 L 51 6 L 56 14 L 62 4 L 56 22 Z" 
        fill="#FA5F11" 
        stroke="#FFFFFF" 
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Sketchy accent lightning spark */}
      <path 
        d="M62 7 L 68 11 L 64 15" 
        stroke="#C5EA4B" 
        strokeWidth="1.5" 
        strokeLinecap="round"
      />

      {/* Main Washing Machine / Dishwasher Body (Square/Geometric Brutalist Appliance) */}
      <rect 
        x="24" 
        y="26" 
        width="52" 
        height="56" 
        fill="#141414" 
        stroke="#FFFFFF" 
        strokeWidth="2.5" 
      />
      
      {/* Top Control Panel of Dishwasher */}
      <line x1="24" y1="36" x2="76" y2="36" stroke="#444444" strokeWidth="1.5" />
      {/* Knobs and LED indicators */}
      <circle cx="31" cy="31" r="2.5" fill="#FA5F11" stroke="#FFFFFF" strokeWidth="1" />
      <circle cx="38" cy="31" r="1.5" fill="#C5EA4B" />
      <circle cx="43" cy="31" r="1.5" fill="#888888" />
      <line x1="62" y1="31" x2="70" y2="31" stroke="#C5EA4B" strokeWidth="2" strokeLinecap="square" />

      {/* Front Circular Porthole / Glass Door */}
      <circle 
        cx="50" 
        cy="58" 
        r="18" 
        fill="#0C0C0C" 
        stroke="#FFFFFF" 
        strokeWidth="2" 
      />
      {/* Inner wash tub water swirl */}
      <path 
        d="M36 60 Q 43 68 50 60 T 64 60" 
        stroke="#C5EA4B" 
        strokeWidth="1.5" 
        strokeLinecap="round" 
        strokeDasharray="3 3"
      />

      {/* Rotom Face inside door - Mischievous hand-drawn expression */}
      {/* Left Eye */}
      <ellipse cx="43" cy="54" rx="2.5" ry="4.5" fill="#FFFFFF" transform="rotate(-10 43 54)" />
      <ellipse cx="43.5" cy="54.5" rx="1.2" ry="2.2" fill="#0C0C0C" />

      {/* Right Eye */}
      <ellipse cx="57" cy="54" rx="2.5" ry="4.5" fill="#FFFFFF" transform="rotate(10 57 54)" />
      <ellipse cx="56.5" cy="54.5" rx="1.2" ry="2.2" fill="#0C0C0C" />

      {/* Wide cheeky Rotom grin */}
      <path 
        d="M44 63 Q 50 68 56 63" 
        stroke="#FFFFFF" 
        strokeWidth="2" 
        strokeLinecap="round" 
      />

      {/* Water Spray / Electric Plasma Hose Arms on Sides */}
      {/* Left Arm */}
      <path 
        d="M24 50 C 14 45, 10 58, 6 62" 
        stroke="#C5EA4B" 
        strokeWidth="2" 
        strokeLinecap="round"
      />
      {/* Right Arm Hose with Water Droplets */}
      <path 
        d="M76 50 C 86 46, 92 56, 95 64" 
        stroke="#C5EA4B" 
        strokeWidth="2" 
        strokeLinecap="round"
      />
      <circle cx="95" cy="54" r="1.5" fill="#C5EA4B" />
      <circle cx="89" cy="42" r="1" fill="#FFFFFF" />

      {/* Appliance Bottom Feet (Sharp boxy stand) */}
      <rect x="29" y="82" width="7" height="4" fill="#888888" stroke="#FFFFFF" strokeWidth="1" />
      <rect x="64" y="82" width="7" height="4" fill="#888888" stroke="#FFFFFF" strokeWidth="1" />
    </svg>
  );
};
