'use client';

import { useEffect, useMemo, useState } from 'react';
import { getTripCountdown } from '@/lib/helpers';

/** Local invalidation for time-derived presentation, never shared domain state. */
export function useTripClockTick(enabled: boolean) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const interval = window.setInterval(() => setTick((current) => current + 1), 1000);
    return () => window.clearInterval(interval);
  }, [enabled]);

  return tick;
}

export function useTripCountdown(startDate: string | undefined) {
  const tick = useTripClockTick(startDate !== undefined);
  return useMemo(() => {
    void tick;
    return startDate === undefined ? null : getTripCountdown(startDate);
  }, [startDate, tick]);
}
