import type { Metadata, Viewport } from 'next';
import {
  Barlow_Condensed,
  DM_Sans,
  DM_Serif_Display,
  Inter,
  JetBrains_Mono,
} from 'next/font/google';
import './globals.css';
import '@maptiler/sdk/dist/maptiler-sdk.css';
import { TopoBackground } from '@/components/ui/TopoBackground';
import OfflineShellRegistration from '@/components/offline/OfflineShellRegistration';

const dmSerifDisplay = DM_Serif_Display({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-trip-display',
  fallback: ['Georgia', 'Times New Roman', 'serif'],
});

const barlowCondensed = Barlow_Condensed({
  weight: '800',
  style: 'normal',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display-face',
  fallback: ['Arial Narrow', 'Arial', 'sans-serif'],
});

const dmSans = DM_Sans({
  weight: ['400', '500', '600', '700'],
  style: 'normal',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-ui-face',
  fallback: ['Arial', 'sans-serif'],
});

// Phase 1 compatibility bridge: preserve the current rendered product until
// DM Sans and the narrower technical Mono role are applied in Visual Phase 2.
const interCompatibility = Inter({
  weight: ['400', '500', '600', '700'],
  style: 'normal',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans-compat-face',
  fallback: ['Arial', 'sans-serif'],
});

const jetBrainsMonoCompatibility = JetBrains_Mono({
  weight: ['400', '500', '700'],
  style: 'normal',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono-compat-face',
  fallback: ['Courier New', 'monospace'],
});

const typographyVariableClasses = [
  dmSerifDisplay.variable,
  barlowCondensed.variable,
  dmSans.variable,
  interCompatibility.variable,
  jetBrainsMonoCompatibility.variable,
].join(' ');

export const metadata: Metadata = {
  applicationName: 'Field Protocol',
  title: 'Field Protocol',
  description: 'A field-ready camping trip workspace for plans, gear, crew, and conditions.',
  keywords: ['camping', 'trip planning', 'gear', 'crew', 'field guide'],
  authors: [{ name: 'Field Protocol' }],
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0a0f1a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
      </head>
      <body className={typographyVariableClasses}>
        <OfflineShellRegistration />
        <TopoBackground />
        <div className="relative z-10 min-h-screen">
          {children}
        </div>
      </body>
    </html>
  );
}
