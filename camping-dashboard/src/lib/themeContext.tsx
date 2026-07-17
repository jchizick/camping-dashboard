'use client';

// ============================================================
// themeContext.tsx — Theme variant + day/night mode provider
// Reads theme_variant and manual_theme_override from trip settings.
// Applies CSS classes to <html>: e.g. "theme-expedition dark"
// ============================================================

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ThemeVariant, ThemeMode, ThemeOverride, Settings } from '@/types';
import { getLabels, LABELS } from '@/lib/labels';

interface ThemeContextValue {
  themeVariant: ThemeVariant;
  themeMode: ThemeMode;
  labels: Record<keyof typeof LABELS['expedition'], string>;
  setThemeVariant: (v: ThemeVariant) => void;
  setThemeOverride: (o: ThemeOverride) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  themeVariant: 'expedition',
  themeMode: 'night',
  labels: getLabels('expedition'),
  setThemeVariant: () => {},
  setThemeOverride: () => {},
});

function resolveThemeMode(override: ThemeOverride, sunriseTime?: string, sunsetTime?: string): ThemeMode {
  if (override === 'day') return 'day';
  if (override === 'night') return 'night';

  // Auto mode: use sunrise/sunset if available, otherwise default to night
  if (sunriseTime && sunsetTime) {
    const now = new Date();
    const [sh, sm] = sunriseTime.split(':').map(Number);
    const [eth, etm] = sunsetTime.split(':').map(Number);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const sunriseMinutes = sh * 60 + sm;
    const sunsetMinutes = eth * 60 + etm;
    return nowMinutes >= sunriseMinutes && nowMinutes < sunsetMinutes ? 'day' : 'night';
  }

  return 'night';
}

export function ThemeProvider({
  settings,
  sunriseTime,
  sunsetTime,
  children,
}: {
  settings: Settings | null;
  sunriseTime?: string;
  sunsetTime?: string;
  children: React.ReactNode;
}) {
  const [themeVariant, setThemeVariant] = useState<ThemeVariant>(settings?.theme_variant ?? 'expedition');
  const [themeOverride, setThemeOverride] = useState<ThemeOverride>(settings?.manual_theme_override ?? 'night');
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => resolveThemeMode(themeOverride, sunriseTime, sunsetTime));

  // Resolve mode when override or sun times change
  useEffect(() => {
    setThemeMode(resolveThemeMode(themeOverride, sunriseTime, sunsetTime));
  }, [themeOverride, sunriseTime, sunsetTime]);

  // Apply CSS classes to <html>
  useEffect(() => {
    const html = document.documentElement;

    // Remove old theme classes
    html.classList.remove('theme-expedition', 'theme-clean', 'dark');

    // Apply current theme variant
    html.classList.add(`theme-${themeVariant}`);

    // Apply dark mode if night
    if (themeMode === 'night') {
      html.classList.add('dark');
    }
  }, [themeVariant, themeMode]);

  const handleSetVariant = useCallback((v: ThemeVariant) => {
    setThemeVariant(v);
  }, []);

  const handleSetOverride = useCallback((o: ThemeOverride) => {
    setThemeOverride(o);
  }, []);

  return (
    <ThemeContext.Provider value={{
      themeVariant,
      themeMode,
      labels: getLabels(themeVariant),
      setThemeVariant: handleSetVariant,
      setThemeOverride: handleSetOverride,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
