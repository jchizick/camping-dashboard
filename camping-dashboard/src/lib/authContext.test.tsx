// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithOAuth: vi.fn(),
  signOut: vi.fn(),
  unsubscribe: vi.fn(),
}));
const navigationMocks = vi.hoisted(() => ({
  returnToSignIn: vi.fn(),
}));
const repositoryMocks = vi.hoisted(() => ({
  clearUserCache: vi.fn(),
  readOfflineTrip: vi.fn(),
  clearOfflineIdentity: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: supabaseMocks.getUser,
      onAuthStateChange: supabaseMocks.onAuthStateChange,
      signInWithOAuth: supabaseMocks.signInWithOAuth,
      signOut: supabaseMocks.signOut,
    },
  },
}));
vi.mock('@/lib/authNavigation', () => navigationMocks);
vi.mock('@/lib/tripRepository', () => ({
  tripRepository: {
    clearUserCache: repositoryMocks.clearUserCache,
    readOfflineTrip: repositoryMocks.readOfflineTrip,
    clearOfflineIdentity: repositoryMocks.clearOfflineIdentity,
  },
}));

import { AuthProvider, useAuth } from './authContext';

function AuthHarness() {
  const { user, identity, isLoading, signIn, signOut } = useAuth();

  return (
    <>
      <p>{isLoading ? 'loading' : user ? 'authenticated' : 'anonymous'}</p>
      <p data-testid="identity">
        {identity ? `${identity.userId}:${identity.source}` : 'none'}
      </p>
      <button type="button" onClick={() => void signIn()}>Sign in</button>
      <button type="button" onClick={() => void signOut()}>Sign out</button>
    </>
  );
}

describe('AuthProvider actions', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/trips?next=%2Ftrips%2Ftrip-123');
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });
    supabaseMocks.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: supabaseMocks.unsubscribe } },
    });
    supabaseMocks.signInWithOAuth.mockResolvedValue({ data: {}, error: null });
    supabaseMocks.signOut.mockResolvedValue({ error: null });
    repositoryMocks.clearUserCache.mockReset();
    repositoryMocks.clearUserCache.mockResolvedValue(undefined);
    repositoryMocks.readOfflineTrip.mockReset();
    repositoryMocks.readOfflineTrip.mockResolvedValue({
      status: 'no-identity',
      identity: null,
      workspace: null,
    });
    repositoryMocks.clearOfflineIdentity.mockReset();
    repositoryMocks.clearOfflineIdentity.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it('starts Google OAuth with the exact callback route and safe next path', async () => {
    render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(supabaseMocks.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: {
          redirectTo:
            'http://localhost:3000/auth/callback?next=%2Ftrips%2Ftrip-123',
        },
      });
    });
  });

  it('clears the current user cache before Supabase sign-out', async () => {
    render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>
    );
    await screen.findByText('authenticated');

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => {
      expect(repositoryMocks.clearUserCache).toHaveBeenCalledWith({
        userId: 'user-123',
      });
      expect(supabaseMocks.signOut).toHaveBeenCalledOnce();
      expect(navigationMocks.returnToSignIn).toHaveBeenCalledOnce();
      expect(screen.getByText('anonymous')).toBeTruthy();
    });
    expect(repositoryMocks.clearUserCache.mock.invocationCallOrder[0]).toBeLessThan(
      supabaseMocks.signOut.mock.invocationCallOrder[0]
    );
  });

  it('reports a cache-clear failure but still completes sign-out', async () => {
    const error = new Error('IndexedDB unavailable');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    repositoryMocks.clearUserCache.mockRejectedValue(error);
    render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>
    );
    await screen.findByText('authenticated');

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        '[auth] Cached trip data could not be cleared.',
        error
      );
      expect(supabaseMocks.signOut).toHaveBeenCalledOnce();
      expect(navigationMocks.returnToSignIn).toHaveBeenCalledOnce();
      expect(screen.getByText('anonymous')).toBeTruthy();
    });
    expect(repositoryMocks.clearOfflineIdentity).toHaveBeenCalledOnce();
  });

  it('uses only the validated local identity pointer when online auth is unreachable', async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Failed to fetch' },
    });
    repositoryMocks.readOfflineTrip.mockResolvedValue({
      status: 'available',
      identity: {
        projectNamespace: 'project',
        activeUserId: 'saved-user',
        lastVerifiedAt: '2026-08-24T12:00:00.000Z',
        shellPreparedAt: '2026-08-24T12:00:00.000Z',
      },
      workspace: {},
    });

    render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId('identity').textContent).toBe('saved-user:local')
    );
    expect(repositoryMocks.clearOfflineIdentity).not.toHaveBeenCalled();
  });

  it('treats an explicit online anonymous result as authoritative', async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>
    );

    await screen.findByText('anonymous');
    expect(screen.getByTestId('identity').textContent).toBe('none');
    expect(repositoryMocks.readOfflineTrip).not.toHaveBeenCalled();
    expect(repositoryMocks.clearOfflineIdentity).toHaveBeenCalledOnce();
  });
});
