// @vitest-environment jsdom

import React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PHONE_LAYOUT_MEDIA_QUERY,
  PhoneLayoutProvider,
  usePhoneLayout,
} from './PhoneLayoutProvider';

interface ViewportFixture {
  width: number;
  height: number;
  pointer: 'coarse' | 'fine';
}

function matchesPhoneLayout({ width, height, pointer }: ViewportFixture) {
  return width <= 767 || (
    width > height &&
    width <= 956 &&
    height <= 600 &&
    pointer === 'coarse'
  );
}

function installMatchMedia(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<() => void>();
  const mediaQuery = {
    get matches() {
      return matches;
    },
    media: PHONE_LAYOUT_MEDIA_QUERY,
    onchange: null,
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
    addListener: (listener: () => void) => listeners.add(listener),
    removeListener: (listener: () => void) => listeners.delete(listener),
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList;
  const matchMedia = vi.fn(() => mediaQuery);
  vi.stubGlobal('matchMedia', matchMedia);

  return {
    matchMedia,
    setMatches(nextMatches: boolean) {
      matches = nextMatches;
      act(() => listeners.forEach((listener) => listener()));
    },
  };
}

function LayoutState() {
  const isPhoneLayout = usePhoneLayout();
  return <output>{isPhoneLayout ? 'phone' : 'tablet-desktop'}</output>;
}

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('data-phone-layout');
  vi.unstubAllGlobals();
});

describe('PhoneLayoutProvider', () => {
  it('defines one canonical semantic phone-layout query', () => {
    expect(PHONE_LAYOUT_MEDIA_QUERY).toBe(
      '(max-width: 767px), (orientation: landscape) and (max-width: 956px) and (max-height: 600px) and (pointer: coarse)'
    );
  });

  it.each([
    ['small portrait phone', { width: 360, height: 800, pointer: 'coarse' }, true],
    ['portrait phone', { width: 390, height: 844, pointer: 'coarse' }, true],
    ['large portrait phone', { width: 414, height: 896, pointer: 'coarse' }, true],
    ['landscape phone', { width: 844, height: 390, pointer: 'coarse' }, true],
    ['landscape phone at 852px', { width: 852, height: 393, pointer: 'coarse' }, true],
    ['landscape phone at 896px', { width: 896, height: 414, pointer: 'coarse' }, true],
    ['landscape phone at 932px', { width: 932, height: 430, pointer: 'coarse' }, true],
    ['widest landscape phone', { width: 956, height: 430, pointer: 'coarse' }, true],
    ['tablet portrait', { width: 768, height: 1024, pointer: 'coarse' }, false],
    ['large tablet portrait', { width: 820, height: 1180, pointer: 'coarse' }, false],
    ['tablet landscape', { width: 1024, height: 768, pointer: 'coarse' }, false],
    ['large tablet landscape', { width: 1180, height: 820, pointer: 'coarse' }, false],
    ['short fine-pointer viewport', { width: 956, height: 430, pointer: 'fine' }, false],
    ['short desktop viewport', { width: 1000, height: 500, pointer: 'fine' }, false],
  ] as const)('classifies %s correctly', async (_label, fixture, expected) => {
    const media = installMatchMedia(matchesPhoneLayout(fixture));
    render(
      <PhoneLayoutProvider>
        <LayoutState />
      </PhoneLayoutProvider>
    );

    expect(screen.getByText(expected ? 'phone' : 'tablet-desktop')).toBeTruthy();
    await waitFor(() => {
      expect(document.documentElement.hasAttribute('data-phone-layout')).toBe(expected);
    });
    expect(media.matchMedia).toHaveBeenCalledOnce();
    expect(media.matchMedia).toHaveBeenCalledWith(PHONE_LAYOUT_MEDIA_QUERY);
  });

  it('updates subscribers and the document marker when the media query changes', async () => {
    const media = installMatchMedia(false);
    const view = render(
      <PhoneLayoutProvider>
        <LayoutState />
      </PhoneLayoutProvider>
    );

    expect(screen.getByText('tablet-desktop')).toBeTruthy();
    expect(document.documentElement.hasAttribute('data-phone-layout')).toBe(false);

    media.setMatches(true);
    expect(screen.getByText('phone')).toBeTruthy();
    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-phone-layout')).toBe('true');
    });

    media.setMatches(false);
    expect(screen.getByText('tablet-desktop')).toBeTruthy();
    await waitFor(() => {
      expect(document.documentElement.hasAttribute('data-phone-layout')).toBe(false);
    });

    view.unmount();
    expect(document.documentElement.hasAttribute('data-phone-layout')).toBe(false);
  });
});
