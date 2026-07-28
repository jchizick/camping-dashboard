import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isDevelopmentLoginAvailable } from '@/lib/devLogin';

const { notFound } = vi.hoisted(() => ({ notFound: vi.fn() }));

vi.mock('next/navigation', () => ({ notFound }));
vi.mock('./DevLoginForm', () => ({ default: () => null }));

describe('DevLoginPage', () => {
  beforeEach(() => {
    vi.resetModules();
    notFound.mockImplementation(() => {
      throw new Error('NEXT_NOT_FOUND');
    });
  });

  it('is unavailable outside development', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { default: DevLoginPage } = await import('./page');

    expect(() => DevLoginPage()).toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it('renders only in development', async () => {
    expect(isDevelopmentLoginAvailable('development')).toBe(true);
    expect(isDevelopmentLoginAvailable('test')).toBe(false);
    expect(isDevelopmentLoginAvailable('production')).toBe(false);
  });
});
