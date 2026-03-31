import type { Metadata, Viewport } from 'next';
import './globals.css';
import { TopoBackground } from '@/components/ui/TopoBackground';

export const metadata: Metadata = {
  title: 'Algonquin Trip — Expedition Control',
  description: 'Wilderness mission control dashboard for Algonquin Park · Maple Lake Site 4 backcountry canoe trip.',
  keywords: ['Algonquin', 'camping', 'canoe', 'trip planning', 'wilderness'],
  authors: [{ name: 'Expedition Control' }],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0a0f1a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <TopoBackground />
        <div className="relative z-10 min-h-screen">
          {children}
        </div>
      </body>
    </html>
  );
}
