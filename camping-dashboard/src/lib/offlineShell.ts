export const FIELD_PROTOCOL_BUILD_ID =
  process.env.NEXT_PUBLIC_FIELD_PROTOCOL_BUILD_ID ?? 'development';
export const FIELD_PROTOCOL_SERVICE_WORKER_URL =
  `/sw.js?v=${encodeURIComponent(FIELD_PROTOCOL_BUILD_ID)}`;
export const FIELD_PROTOCOL_SHELL_CACHE_PREFIX = 'field-protocol-shell-';

export function canUseOfflineShell(
  environment = process.env.NODE_ENV,
  location = typeof window === 'undefined' ? null : window.location
) {
  if (environment !== 'production' || typeof navigator === 'undefined') return false;
  if (!('serviceWorker' in navigator) || !location) return false;
  return location.protocol === 'https:' || location.hostname === 'localhost';
}

export async function registerOfflineShell(): Promise<ServiceWorkerRegistration | null> {
  if (!canUseOfflineShell()) return null;
  try {
    return await navigator.serviceWorker.register(FIELD_PROTOCOL_SERVICE_WORKER_URL, {
      scope: '/',
      updateViaCache: 'none',
    });
  } catch (error) {
    console.error('[offlineShell] Service worker registration failed.', error);
    return null;
  }
}

export async function removeFieldProtocolWorkerInDevelopment() {
  if (
    process.env.NODE_ENV === 'production' ||
    typeof navigator === 'undefined' ||
    !('serviceWorker' in navigator)
  ) {
    return;
  }
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    registrations
      .filter((registration) => {
        const script =
          registration.active?.scriptURL ??
          registration.waiting?.scriptURL ??
          registration.installing?.scriptURL ??
          '';
        return (
          new URL(script, window.location.origin).pathname ===
          new URL(FIELD_PROTOCOL_SERVICE_WORKER_URL, window.location.origin).pathname
        );
      })
      .map((registration) => registration.unregister())
  );
  if ('caches' in window) {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter((name) => name.startsWith(FIELD_PROTOCOL_SHELL_CACHE_PREFIX))
        .map((name) => caches.delete(name))
    );
  }
}

export async function prepareOfflineShell(): Promise<boolean> {
  const registration = await registerOfflineShell();
  if (!registration) return false;
  try {
    const expectedWorkerUrl = new URL(
      FIELD_PROTOCOL_SERVICE_WORKER_URL,
      window.location.origin
    ).href;
    const targetWorker =
      [registration.installing, registration.waiting, registration.active].find(
        (worker) => worker?.scriptURL === expectedWorkerUrl
      ) ?? null;
    if (targetWorker?.state === 'installing') {
      const installed = await Promise.race([
        new Promise<boolean>((resolve) => {
          targetWorker.addEventListener('statechange', () => {
            if (targetWorker.state === 'installed' || targetWorker.state === 'activated') {
              resolve(true);
            } else if (targetWorker.state === 'redundant') {
              resolve(false);
            }
          });
        }),
        new Promise<false>((resolve) => window.setTimeout(() => resolve(false), 15_000)),
      ]);
      if (!installed) return false;
      return true;
    }
    if (targetWorker?.state === 'installed') return true;

    const ready = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 15_000)),
    ]);
    if (!ready) return false;
    const worker =
      [ready.active, registration.active].find(
        (candidate) => candidate?.scriptURL === expectedWorkerUrl
      ) ?? null;
    if (!worker) return false;
    return await new Promise<boolean>((resolve) => {
      const channel = new MessageChannel();
      const timeout = window.setTimeout(() => resolve(false), 15_000);
      channel.port1.onmessage = (event: MessageEvent<{ ok?: boolean }>) => {
        window.clearTimeout(timeout);
        resolve(event.data?.ok === true);
      };
      worker.postMessage({ type: 'PREPARE_OFFLINE_SHELL' }, [channel.port2]);
    });
  } catch (error) {
    console.error('[offlineShell] Application shell preparation failed.', error);
    return false;
  }
}
