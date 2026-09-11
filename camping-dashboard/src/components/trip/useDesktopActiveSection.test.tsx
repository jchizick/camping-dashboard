// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useDesktopActiveSection } from './useDesktopActiveSection';

afterEach(() => { cleanup(); document.body.innerHTML = ''; vi.unstubAllGlobals(); });

it('hands route state to the viewport, reverses, and handles a short final section without navigation', () => {
  const callbacks: IntersectionObserverCallback[] = [];
  const disconnect = vi.fn();
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: IntersectionObserverCallback) { callbacks.push(callback); }
    observe = vi.fn(); disconnect = disconnect;
  });
  const names = ['overview', 'plan', 'gear', 'crew', 'field'];
  document.body.innerHTML = `<div data-desktop-workspace-document>${names.map(name => `<section><h2 id="desktop-${name}-title"></h2></section>`).join('')}<div data-desktop-workspace-end></div></div>`;
  let activeIndex = 0;
  document.querySelectorAll('section').forEach((section, index) => {
    section.getBoundingClientRect = () => ({ top: index <= activeIndex ? 0 : 500 }) as DOMRect;
  });
  const push = vi.spyOn(history, 'pushState');
  const focus = vi.spyOn(HTMLElement.prototype, 'focus');
  const { result, rerender, unmount } = renderHook(({ path }) => useDesktopActiveSection(path, 't'), { initialProps: { path: '/trips/t' } });
  expect(result.current).toBe('/trips/t');
  const paths = ['/trips/t', '/trips/t/plan', '/trips/t/gear', '/trips/t/crew', '/trips/t/guide'];
  for (const index of [1, 2, 3, 4, 3, 2, 1, 0]) {
    activeIndex = index;
    act(() => callbacks[0]([], {} as IntersectionObserver));
    expect(result.current).toBe(paths[index]);
  }
  rerender({ path: '/trips/t/gear' });
  expect(result.current).toBe('/trips/t/gear');
  activeIndex = 3;
  act(() => callbacks[2]([], {} as IntersectionObserver));
  expect(result.current).toBe('/trips/t/crew');
  vi.stubGlobal('scrollY', 100);
  act(() => callbacks[3]([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
  expect(result.current).toBe('/trips/t/guide');
  act(() => callbacks[3]([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver));
  expect(result.current).toBe('/trips/t/crew');
  expect(push).not.toHaveBeenCalled();
  expect(focus).not.toHaveBeenCalled();
  unmount();
  expect(disconnect).toHaveBeenCalled();
  vi.restoreAllMocks();
});

it('does not observe auxiliary routes or absent desktop documents', () => {
  const observer = vi.fn();
  vi.stubGlobal('IntersectionObserver', observer);
  const { rerender } = renderHook(({ path }) => useDesktopActiveSection(path, 't'), { initialProps: { path: '/trips/t/field-log' } });
  rerender({ path: '/trips/t' });
  expect(observer).not.toHaveBeenCalled();
});
