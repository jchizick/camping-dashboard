// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { integrateDesktopGeocoder } from './desktopGeocoder';

afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

describe('desktop geocoder adapter', () => {
  it('themes existing and newly rendered results, names the focus control, and restores phone markup', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const host = document.createElement('maptiler-geocoder' as string);
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = '<form><button class="search-button" type="button"></button><input aria-label="Search places" /><ul></ul></form>';
    container.append(host);
    const stop = integrateDesktopGeocoder(container);
    expect(root.querySelector('style')?.textContent).toContain('font-size: 16px');
    expect(root.querySelector('button')?.getAttribute('aria-label')).toBe('Focus destination search');
    const result = document.createElement('maptiler-geocoder-feature-item');
    const resultRoot = result.attachShadow({ mode: 'open' });
    resultRoot.innerHTML = '<li role="option">Lake</li>';
    const list = root.querySelector('ul')!;
    list.append(result);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(resultRoot.querySelector('style')?.textContent).toContain('li.selected');
    expect(resultRoot.querySelector('li')?.textContent).toBe('Lake');
    list.getBoundingClientRect = () => ({ top: 0, bottom: 100 } as DOMRect);
    const option = resultRoot.querySelector('li')!;
    option.getBoundingClientRect = () => ({ top: 140, bottom: 180 } as DOMRect);
    option.setAttribute('aria-selected', 'true');
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(list.scrollTop).toBe(80);
    stop();
    expect(root.querySelector('style')).toBeNull();
    expect(resultRoot.querySelector('style')).toBeNull();
    expect(root.querySelector('button')?.hasAttribute('aria-label')).toBe(false);
    expect(root.querySelector('input')?.getAttribute('aria-label')).toBe('Search places');
  });

  it('leaves unknown SDK markup and existing accessible names intact', () => {
    const container = document.createElement('div');
    const host = document.createElement('maptiler-geocoder' as string);
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = '<button class="search-button" aria-label="SDK search"></button>';
    container.append(host);
    const stop = integrateDesktopGeocoder(container);
    expect(root.querySelector('button')?.getAttribute('aria-label')).toBe('SDK search');
    stop();
    expect(root.querySelector('button')?.getAttribute('aria-label')).toBe('SDK search');
    expect(() => integrateDesktopGeocoder(document.createElement('div'))()).not.toThrow();
  });

  it('disconnects and releases retired result roots between searches', async () => {
    const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
    const container = document.createElement('div');
    const host = document.createElement('maptiler-geocoder' as string);
    const root = host.attachShadow({ mode: 'open' });
    const result = document.createElement('maptiler-geocoder-feature-item');
    const resultRoot = result.attachShadow({ mode: 'open' });
    root.append(result);
    container.append(host);
    const stop = integrateDesktopGeocoder(container);
    expect(resultRoot.querySelector('style')).not.toBeNull();
    result.remove();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(resultRoot.querySelector('style')).toBeNull();
    root.append(result);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(resultRoot.querySelectorAll('style')).toHaveLength(1);
    stop();
    expect(disconnect).toHaveBeenCalledTimes(4);
  });
});
