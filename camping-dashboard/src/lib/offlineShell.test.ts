// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  canUseOfflineShell,
  registerOfflineShell,
  removeFieldProtocolWorkerInDevelopment,
} from './offlineShell';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('offline shell registration policy', () => {
  it('allows only production secure contexts or localhost with service-worker support', () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {},
    });
    expect(canUseOfflineShell('production', {
      protocol: 'https:',
      hostname: 'field-protocol.test',
    } as Location)).toBe(true);
    expect(canUseOfflineShell('production', {
      protocol: 'http:',
      hostname: 'localhost',
    } as Location)).toBe(true);
    expect(canUseOfflineShell('development', {
      protocol: 'https:',
      hostname: 'field-protocol.test',
    } as Location)).toBe(false);
    expect(canUseOfflineShell('production', {
      protocol: 'http:',
      hostname: 'field-protocol.test',
    } as Location)).toBe(false);
  });

  it('registers the exact root-scoped worker without the HTTP cache in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const register = vi.fn().mockResolvedValue({});
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { register },
    });

    await registerOfflineShell();

    expect(register).toHaveBeenCalledWith(
      expect.stringMatching(/^\/sw\.js\?v=[a-zA-Z0-9._-]+$/),
      {
      scope: '/',
      updateViaCache: 'none',
      }
    );
  });

  it('development cleanup removes only this product worker and prefixed caches', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const fieldUnregister = vi.fn().mockResolvedValue(true);
    const unrelatedUnregister = vi.fn().mockResolvedValue(true);
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        getRegistrations: vi.fn().mockResolvedValue([
          { active: { scriptURL: 'http://localhost:3000/sw.js' }, unregister: fieldUnregister },
          { active: { scriptURL: 'http://localhost:3000/other.js' }, unregister: unrelatedUnregister },
        ]),
      },
    });
    const deleteCache = vi.fn().mockResolvedValue(true);
    Object.defineProperty(window, 'caches', {
      configurable: true,
      value: {
        keys: vi.fn().mockResolvedValue(['field-protocol-shell-old', 'another-app-cache']),
        delete: deleteCache,
      },
    });

    await removeFieldProtocolWorkerInDevelopment();

    expect(fieldUnregister).toHaveBeenCalledOnce();
    expect(unrelatedUnregister).not.toHaveBeenCalled();
    expect(deleteCache).toHaveBeenCalledWith('field-protocol-shell-old');
    expect(deleteCache).not.toHaveBeenCalledWith('another-app-cache');
  });
});
