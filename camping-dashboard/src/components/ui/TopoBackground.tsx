import React from 'react';

export const TopoBackground = () => {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-app-bg transition-colors duration-300">
      
      {/* 1. Macro Terrain Depth Layer */}
      <div className="absolute inset-0 opacity-[0.04] dark:opacity-[0.03] mix-blend-multiply dark:mix-blend-screen">
        <svg className="w-full h-full" viewBox="0 0 1440 1024" preserveAspectRatio="xMidYMid slice">
          <defs>
            <filter id="macro-blur" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="120" />
            </filter>
          </defs>
          <ellipse cx="200" cy="200" rx="500" ry="400" fill="currentColor" filter="url(#macro-blur)" className="text-text-muted" />
          <ellipse cx="1300" cy="800" rx="600" ry="500" fill="currentColor" filter="url(#macro-blur)" className="text-text-muted" />
          <ellipse cx="800" cy="1000" rx="700" ry="300" fill="currentColor" filter="url(#macro-blur)" className="text-text-muted" />
        </svg>
      </div>

      {/* 2. Path-Based SVG Topo System */}
      <div 
        className="absolute inset-0 opacity-[0.25] dark:opacity-[0.15] transition-opacity duration-300"
        style={{
          maskImage: 'linear-gradient(to bottom, black 0%, black 35%, transparent 90%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 35%, transparent 90%)'
        }}
      >
        <svg className="w-full h-full stroke-black dark:stroke-white transition-colors duration-300" viewBox="0 0 1440 1024" preserveAspectRatio="xMidYMid slice" fill="none" strokeWidth="1.5">
          
          {/* Zone 1: Top Left Ridge */}
          <g className="opacity-80">
            <path d="M -100,200 C 150,150 250,350 500,300 C 750,250 850,100 1100,150 C 1350,200 1450,50 1600,100" />
            <path d="M -100,170 C 160,110 270,310 520,260 C 770,210 870,60 1120,110 C 1370,160 1470,10 1600,60" />
            <path d="M -100,130 C 170,60 290,260 540,210 C 790,160 890,10 1140,60 C 1390,110 1490,-40 1600,10" />
            <path d="M -100,80 C 180,0 310,200 560,150 C 810,100 910,-50 1160,0 C 1410,50 1510,-100 1600,-50" />
            <path d="M -100,20 C 190,-70 330,130 580,80 C 830,30 930,-120 1180,-70 C 1430,-20 1530,-170 1600,-120" />
            <path d="M -100,-50 C 200,-150 350,50 600,0 C 850,-50 950,-200 1200,-150 C 1450,-100 1550,-250 1600,-200" />
          </g>

          {/* Zone 2: Middle Flow */}
          <g className="opacity-60">
            <path d="M -100,400 C 200,380 300,580 600,500 C 900,420 1000,250 1300,300 C 1500,330 1550,200 1600,250" />
            <path d="M -100,440 C 220,420 320,630 630,540 C 940,450 1030,280 1330,340 C 1520,380 1570,240 1600,300" />
            <path d="M -100,490 C 250,470 350,690 670,590 C 990,490 1070,320 1370,390 C 1550,440 1590,290 1600,360" />
            <path d="M -100,550 C 290,530 390,760 720,650 C 1050,540 1120,370 1420,450 C 1590,510 1620,350 1600,430" />
            <path d="M -100,620 C 340,600 440,840 780,720 C 1120,600 1180,430 1480,520 C 1640,590 1660,420 1600,510" />
          </g>

          {/* Zone 3: Bottom Right Elevation */}
          <g className="opacity-50">
            <path d="M 500,1100 C 700,900 900,1050 1100,850 C 1300,650 1400,800 1600,600" />
            <path d="M 550,1150 C 760,940 950,1100 1160,890 C 1370,680 1460,840 1600,650" />
            <path d="M 610,1200 C 830,990 1010,1160 1230,940 C 1450,720 1530,890 1600,710" />
            <path d="M 680,1250 C 910,1050 1080,1230 1310,1000 C 1540,770 1610,950 1600,780" />
            <path d="M 760,1300 C 1000,1120 1160,1310 1400,1070 C 1640,830 1700,1020 1600,860" />
          </g>
          
          {/* Zone 4: Organic Peak 1 */}
          <g className="opacity-70">
            <path d="M 1200,150 C 1250,120 1300,160 1280,210 C 1260,260 1200,270 1160,230 C 1120,190 1150,180 1200,150 Z" />
            <path d="M 1200,110 C 1280,70 1350,140 1320,220 C 1290,300 1190,320 1120,260 C 1050,200 1120,150 1200,110 Z" />
            <path d="M 1200,70 C 1320,20 1410,120 1370,230 C 1330,340 1180,370 1080,290 C 980,210 1080,120 1200,70 Z" />
            <path d="M 1200,30 C 1360,-30 1480,100 1430,250 C 1380,400 1170,430 1040,330 C 910,230 1040,90 1200,30 Z" />
          </g>

          {/* Zone 5: Organic Peak 2 */}
          <g className="opacity-60">
            <path d="M 200,600 C 230,580 270,610 260,650 C 250,690 200,700 170,670 C 140,640 170,620 200,600 Z" />
            <path d="M 200,560 C 260,530 320,590 300,670 C 280,750 190,770 130,720 C 70,670 140,590 200,560 Z" />
            <path d="M 200,510 C 300,470 380,560 350,690 C 320,820 170,850 80,770 C -10,690 100,550 200,510 Z" />
          </g>
        </svg>
      </div>

      {/* 3. Ultra-soft Micro-noise Layer */}
      <div 
        className="absolute inset-0 opacity-[0.04] dark:opacity-[0.02] mix-blend-overlay"
        style={{ 
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` 
        }}
      />

      {/* 4. Atmospheric Lighting Layers */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_rgba(255,255,255,0.15)_0%,_transparent_60%)] dark:bg-[radial-gradient(circle_at_50%_0%,_rgba(255,255,255,0.03)_0%,_transparent_60%)]" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent dark:from-black/60" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_transparent_40%,_rgba(0,0,0,0.05)_100%)] dark:bg-[radial-gradient(circle_at_50%_50%,_transparent_40%,_rgba(0,0,0,0.4)_100%)]" />
    </div>
  );
};
