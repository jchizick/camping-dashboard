import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

type WorkerListener = (event: Record<string, unknown>) => void;

function createWorkerHarness(options: {
  version?: string;
  stores?: Map<string, Map<string, Response>>;
  failRequest?: string;
} = {}) {
  const listeners = new Map<string, WorkerListener>();
  const stores = options.stores ?? new Map<string, Map<string, Response>>();
  const requestKey = (request: string | { url?: string }) =>
    typeof request === 'string' ? request : request.url ?? '';
  const caches = {
    open: vi.fn(async (name: string) => {
      const store = stores.get(name) ?? new Map<string, Response>();
      stores.set(name, store);
      return {
        put: async (request: string | { url?: string }, response: Response) => {
          store.set(requestKey(request), response.clone());
        },
      };
    }),
    match: vi.fn(async (request: string | { url?: string }, options?: { cacheName?: string }) => {
      const key = requestKey(request);
      if (options?.cacheName) return stores.get(options.cacheName)?.get(key)?.clone();
      for (const store of stores.values()) {
        const response = store.get(key);
        if (response) return response.clone();
      }
      return undefined;
    }),
    keys: vi.fn(async () => [...stores.keys()]),
    delete: vi.fn(async (name: string) => stores.delete(name)),
  };
  const fetchMock = vi.fn(async (request: string | { url?: string }) => {
    const key = requestKey(request);
    if (key === options.failRequest) {
      throw new TypeError(`Injected transport failure for ${key}`);
    }
    if (key === '/offline') {
      return new Response(
        '<html><head><link href="/_next/static/app.css" rel="stylesheet"></head><body><script src="/_next/static/app.js"></script></body></html>',
        { status: 200, headers: { 'Content-Type': 'text/html' } }
      );
    }
    if (key.startsWith('/_next/static/') || key.startsWith('/')) {
      return new Response(`asset:${key}`, { status: 200 });
    }
    return new Response('network', { status: 200 });
  });
  const self = {
    location: {
      origin: 'https://field-protocol.test',
      href: `https://field-protocol.test/sw.js?v=${options.version ?? 'test-build'}`,
    },
    clients: { claim: vi.fn(async () => undefined) },
    addEventListener: (name: string, listener: WorkerListener) => {
      listeners.set(name, listener);
    },
  };
  const source = readFileSync(
    new URL('../../public/sw.js', import.meta.url),
    'utf8'
  );
  vm.runInNewContext(source, {
    self,
    caches,
    fetch: fetchMock,
    Response,
    Request,
    URL,
    Set,
    Promise,
    Error,
  });

  async function dispatch(name: string, values: Record<string, unknown> = {}) {
    const pending: Promise<unknown>[] = [];
    const responses: Promise<Response>[] = [];
    listeners.get(name)?.({
      ...values,
      waitUntil(value: Promise<unknown>) {
        pending.push(value);
      },
      respondWith(value: Promise<Response>) {
        responses.push(value);
      },
    });
    await Promise.all(pending);
    if (responses.length === 0) return null;
    return await responses[0];
  }

  return { caches, dispatch, fetchMock, stores };
}

describe('Field Protocol service worker', () => {
  it('installs a generic bootstrap and its versioned same-origin assets', async () => {
    const worker = createWorkerHarness();
    await worker.dispatch('install');
    const cache = [...worker.stores.values()][0];
    expect([...cache.keys()]).toEqual(
      expect.arrayContaining([
        '/offline',
        '/_next/static/app.css',
        '/_next/static/app.js',
        '/favicon.ico',
        '/logo.svg',
        '/manifest.webmanifest',
        '/topo-map-bg.svg',
      ])
    );
  });

  it('falls back only when a protected navigation has a transport failure', async () => {
    const worker = createWorkerHarness();
    await worker.dispatch('install');
    worker.fetchMock.mockRejectedValueOnce(new TypeError('network unavailable'));
    const fallback = await worker.dispatch('fetch', {
      request: {
        method: 'GET',
        mode: 'navigate',
        url: 'https://field-protocol.test/trips/trip-1/gear',
      },
    });
    expect(await fallback?.text()).toContain('/_next/static/app.js');

    worker.fetchMock.mockResolvedValueOnce(new Response('denied', { status: 403 }));
    const denied = await worker.dispatch('fetch', {
      request: {
        method: 'GET',
        mode: 'navigate',
        url: 'https://field-protocol.test/trips/trip-1/gear',
      },
    });
    expect(denied?.status).toBe(403);
  });

  it('does not intercept API writes, auth routes, Supabase, or map traffic', async () => {
    const worker = createWorkerHarness();
    for (const request of [
      { method: 'POST', mode: 'cors', url: 'https://field-protocol.test/api/refresh-alerts' },
      { method: 'GET', mode: 'cors', url: 'https://field-protocol.test/auth/callback' },
      { method: 'GET', mode: 'cors', url: 'https://project.supabase.co/rest/v1/trips' },
      { method: 'GET', mode: 'cors', url: 'https://api.maptiler.com/maps/outdoor/style.json' },
    ]) {
      expect(await worker.dispatch('fetch', { request })).toBeNull();
    }
    expect(worker.fetchMock).not.toHaveBeenCalled();
  });

  it('removes only obsolete Field Protocol shell cache versions on activation', async () => {
    const worker = createWorkerHarness();
    worker.stores.set('field-protocol-shell-v1-old', new Map());
    worker.stores.set('unrelated-cache', new Map());
    await worker.dispatch('install');
    await worker.dispatch('activate');
    expect(worker.stores.has('field-protocol-shell-v1-old')).toBe(false);
    expect(worker.stores.has('unrelated-cache')).toBe(true);
  });

  it('keeps Build A usable when Build B installation is interrupted, then promotes a complete B', async () => {
    const stores = new Map<string, Map<string, Response>>();
    const buildA = createWorkerHarness({ version: 'build-a', stores });
    await buildA.dispatch('install');
    await buildA.dispatch('activate');
    expect(stores.has('field-protocol-shell-build-a')).toBe(true);

    const interruptedB = createWorkerHarness({
      version: 'build-b',
      stores,
      failRequest: '/_next/static/app.js',
    });
    await expect(interruptedB.dispatch('install')).rejects.toThrow(
      'Injected transport failure'
    );
    expect(stores.get('field-protocol-shell-build-a')?.has('/offline')).toBe(true);

    buildA.fetchMock.mockRejectedValueOnce(new TypeError('network unavailable'));
    const stillUsable = await buildA.dispatch('fetch', {
      request: {
        method: 'GET',
        mode: 'navigate',
        url: 'https://field-protocol.test/trips/trip-1',
      },
    });
    expect(await stillUsable?.text()).toContain('/_next/static/app.js');

    const buildB = createWorkerHarness({ version: 'build-b', stores });
    await buildB.dispatch('install');
    await buildB.dispatch('activate');
    expect(stores.has('field-protocol-shell-build-a')).toBe(false);
    expect(stores.get('field-protocol-shell-build-b')?.has('/offline')).toBe(true);
  });

  it('fails safely when the current shell cache is externally deleted', async () => {
    const worker = createWorkerHarness();
    await worker.dispatch('install');
    worker.stores.clear();
    worker.fetchMock.mockRejectedValueOnce(new TypeError('network unavailable'));

    const response = await worker.dispatch('fetch', {
      request: {
        method: 'GET',
        mode: 'navigate',
        url: 'https://field-protocol.test/trips/trip-1/crew',
      },
    });

    expect(response?.type).toBe('error');
    expect(worker.stores.size).toBe(0);
  });
});
