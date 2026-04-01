'use client';

import React from 'react';

export const TopoBackground = () => {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-app-bg transition-colors duration-300">

      {/* 1. Macro Terrain Depth Layer — Subtle base shapes */}
      <div className="absolute inset-0 opacity-[0.1] md:opacity-[0.1] dark:opacity-[0.06] md:dark:opacity-[0.04]">
        <svg
          className="w-full h-full"
          viewBox="0 0 1440 1024"
          preserveAspectRatio="xMidYMid slice"
          style={{ filter: 'blur(80px)' }}
        >
          <ellipse cx="400" cy="300" rx="600" ry="500" className="fill-current text-text-muted" />
          <ellipse cx="1200" cy="800" rx="700" ry="600" className="fill-current text-text-muted" />
          <ellipse cx="720" cy="500" rx="800" ry="400" className="fill-current text-text-muted opacity-40" />
        </svg>
      </div>

      {/* 2. Path-Based SVG Topo System — Scaled for mobile breathing room */}
      <div
        className="absolute inset-0 opacity-[0.25] md:opacity-[0.2] dark:opacity-[0.12] md:dark:opacity-[0.1] transition-opacity duration-300 scale-[1.3] md:scale-100"
        style={{
          WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 25%, transparent 95%)',
          maskImage: 'linear-gradient(to bottom, black 0%, black 25%, transparent 95%)',
        }}
      >
        <svg
          className="w-full h-full stroke-black dark:stroke-white transition-colors duration-300"
          viewBox="0 0 1440 1024"
          preserveAspectRatio="xMidYMid slice"
          fill="none"
          strokeWidth="1.1"
        >
          {/* Zone 1: Top Left Ridge */}
          <g opacity="0.8">
            <path d="M 0,200 C 250,150 450,350 720,300 C 990,250 1150,100 1440,150" />
            <path d="M 0,170 C 260,110 470,310 740,260 C 1010,210 1170,60 1440,110" />
            <path d="M 0,130 C 270,60 490,260 760,210 C 1030,160 1190,10 1440,60" />
            <path d="M 0,80 C 280,0 510,200 780,150 C 1050,100 1210,-50 1440,0" />
          </g>

          {/* Zone 2: Middle Flow */}
          <g opacity="0.6">
            <path d="M 0,400 C 300,380 500,580 720,500 C 940,420 1140,250 1440,300" />
            <path d="M 0,440 C 320,420 520,630 750,540 C 980,450 1170,280 1440,340" />
            <path d="M 0,490 C 350,470 550,690 790,590 C 1030,490 1210,320 1440,390" />
            <path d="M 0,550 C 390,530 590,760 840,650 C 1090,540 1260,370 1440,450" />
          </g>

          {/* Zone 3: Bottom Right Elevation */}
          <g opacity="0.5">
            <path d="M 400,1000 C 600,800 800,950 1000,750 C 1200,550 1400,700 1600,500" />
            <path d="M 450,1050 C 660,840 850,1000 1060,790 C 1270,580 1460,740 1600,550" />
            <path d="M 510,1100 C 730,890 910,1060 1130,840 C 1350,620 1530,790 1600,610" />
          </g>

          {/* Zone 4: Central Peak (Mobile Focused) */}
          <g opacity="0.7">
            <path d="M 720,450 C 770,420 820,460 800,510 C 780,560 720,570 680,530 C 640,490 670,480 720,450 Z" />
            <path d="M 720,410 C 800,370 870,440 840,520 C 810,600 710,620 640,560 C 570,500 640,450 720,410 Z" />
            <path d="M 720,360 C 840,310 930,410 890,520 C 850,630 700,660 600,580 C 500,500 600,410 720,360 Z" />
          </g>
        </svg>
      </div>

      {/* 3. Ultra-soft Micro-noise Layer */}
      <div
        className="absolute inset-0 opacity-[0.04] dark:opacity-[0.02]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* 4. Atmospheric Lighting Layers — Dimmed to be less 'bright' */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_rgba(255,255,255,0.1)_0%,_transparent_60%)] dark:bg-[radial-gradient(circle_at_50%_0%,_rgba(255,255,255,0.03)_0%,_transparent_60%)]" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent dark:from-black/80" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_transparent_40%,_rgba(0,0,0,0.05)_100%)] dark:bg-[radial-gradient(circle_at_50%_50%,_transparent_40%,_rgba(0,0,0,0.6)_100%)]" />
    </div>
  );
};
