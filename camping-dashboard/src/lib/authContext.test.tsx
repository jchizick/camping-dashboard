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

import { AuthProvider, useAuth } from './authContext';

function AuthHarness() {
  const { user, isLoading, signIn, signOut } = useAuth();

  return (
    <>
      <p>{isLoading ? 'loading' : user ? 'authenticated' : 'anonymous'}</p>
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

  it('calls Supabase sign-out and clears the local authenticated view', async () => {
    render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>
    );
    await screen.findByText('authenticated');

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => {
      expect(supabaseMocks.signOut).toHaveBeenCalledOnce();
      expect(navigationMocks.returnToSignIn).toHaveBeenCalledOnce();
      expect(screen.getByText('anonymous')).toBeTruthy();
    });
  });
});
