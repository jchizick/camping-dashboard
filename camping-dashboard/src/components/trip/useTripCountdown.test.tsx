// @vitest-environment jsdom

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTripClockTick, useTripCountdown } from './useTripCountdown';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 7, 1, 11, 59, 58));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('local trip clock', () => {
  it('preserves local-noon countdown seconds and the departure transition', () => {
    const { result } = renderHook(() => useTripCountdown('2026-08-01'));
    expect(result.current?.totalSeconds).toBe(2);
    expect(result.current?.isPast).toBe(false);
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current?.totalSeconds).toBe(1);
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current?.totalSeconds).toBe(0);
    expect(result.current?.isPast).toBe(true);
  });

  it('starts after trip loading, updates immediately for edited dates and stops when absent', () => {
    const { result, rerender, unmount } = renderHook(
      ({ date }: { date: string | undefined }) => useTripCountdown(date),
      { initialProps: { date: undefined } as { date: string | undefined } },
    );
    expect(result.current).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    rerender({ date: '2026-08-01' });
    expect(result.current?.totalSeconds).toBe(2);
    rerender({ date: '2026-08-02' });
    expect(result.current?.totalSeconds).toBe(86402);
    expect(vi.getTimerCount()).toBe(1);
    rerender({ date: undefined });
    expect(result.current).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    unmount();
  });

  it('keeps freshness invalidation local and disables it when no longer needed', () => {
    const { result, rerender, unmount } = renderHook(
      ({ enabled }) => useTripClockTick(enabled),
      { initialProps: { enabled: true } },
    );
    act(() => vi.advanceTimersByTime(3000));
    expect(result.current).toBe(3);
    rerender({ enabled: false });
    act(() => vi.advanceTimersByTime(3000));
    expect(result.current).toBe(3);
    expect(vi.getTimerCount()).toBe(0);
    rerender({ enabled: true });
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
