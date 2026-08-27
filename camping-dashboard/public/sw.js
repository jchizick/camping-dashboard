/* Field Protocol Offline Shell — private trip records are never stored here. */
const SHELL_CACHE_PREFIX = 'field-protocol-shell-';
const requestedBuildId = new URL(self.location.href).searchParams.get('v') ?? 'unversioned';
const shellVersion = requestedBuildId.replace(/[^a-zA-Z0-9._-]/g, '-');
const SHELL_CACHE_NAME = `${SHELL_CACHE_PREFIX}${shellVersion}`;
const OFFLINE_BOOTSTRAP_URL = '/offline';
const LOCAL_SHELL_ASSETS = [
  '/favicon.ico',
  '/logo.svg',
  '/manifest.webmanifest',
  '/topo-map-bg.svg',
];

function isProtectedTripNavigation(url) {
  return /^\/trips\/[^/]+(?:\/(?:plan|gear|crew|guide))?\/?$/.test(url.pathname);
}

function isVersionedNextAsset(url) {
  return url.origin === self.location.origin && url.pathname.startsWith('/_next/static/');
}

function isLocalShellAsset(url) {
  return url.origin === self.location.origin && LOCAL_SHELL_ASSETS.includes(url.pathname);
}

function shellAssetUrls(html) {
  const urls = new Set(LOCAL_SHELL_ASSETS);
  for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
    const candidate = new URL(match[1], self.location.origin);
    if (isVersionedNextAsset(candidate) || isLocalShellAsset(candidate)) {
      urls.add(`${candidate.pathname}${candidate.search}`);
    }
  }
  return [...urls];
}

async function cacheResponse(cache, request, response) {
  if (response.ok && response.type !== 'opaque') {
    await cache.put(request, response.clone());
  }
  return response;
}

async function prepareShell() {
  const cache = await caches.open(SHELL_CACHE_NAME);
  const bootstrapResponse = await fetch(OFFLINE_BOOTSTRAP_URL, {
    cache: 'no-store',
    credentials: 'omit',
    redirect: 'error',
  });
  if (!bootstrapResponse.ok) {
    throw new Error(`Offline bootstrap returned ${bootstrapResponse.status}.`);
  }
  const html = await bootstrapResponse.clone().text();
  const assetUrls = shellAssetUrls(html);
  const assetResponses = await Promise.all(
    assetUrls.map(async (url) => {
      const response = await fetch(url, { cache: 'reload', credentials: 'omit' });
      if (!response.ok) throw new Error(`Shell asset failed: ${url}`);
      return [url, response];
    })
  );
  await Promise.all([
    cache.put(OFFLINE_BOOTSTRAP_URL, bootstrapResponse),
    ...assetResponses.map(([url, response]) => cache.put(url, response)),
  ]);
}

self.addEventListener('install', (event) => {
  event.waitUntil(prepareShell());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith(SHELL_CACHE_PREFIX) && name !== SHELL_CACHE_NAME)
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'PREPARE_OFFLINE_SHELL') return;
  event.waitUntil(
    prepareShell()
      .then(() => event.ports[0]?.postMessage({ ok: true, cacheName: SHELL_CACHE_NAME }))
      .catch((error) =>
        event.ports[0]?.postMessage({
          ok: false,
          error: error instanceof Error ? error.message : 'Shell preparation failed.',
        })
      )
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.mode === 'navigate' && isProtectedTripNavigation(url)) {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(OFFLINE_BOOTSTRAP_URL, {
          cacheName: SHELL_CACHE_NAME,
        });
        return cached ?? Response.error();
      })
    );
    return;
  }

  if (isVersionedNextAsset(url) || isLocalShellAsset(url)) {
    event.respondWith(
      caches.match(request, { cacheName: SHELL_CACHE_NAME }).then(
        (cached) =>
          cached ??
          fetch(request).then(async (response) => {
            const cache = await caches.open(SHELL_CACHE_NAME);
            return cacheResponse(cache, request, response);
          })
      )
    );
  }
});
