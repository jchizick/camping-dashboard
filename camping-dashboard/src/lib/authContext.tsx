'use client';

// ============================================================
// authContext.tsx — Auth state provider for the dashboard
// Tracks signed-in user via Supabase authentication.
// No email whitelists — authorization is handled by trip_members
// and the TripProvider in tripContext.tsx.
// ============================================================

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { emailCodeSignInEnabled, emailCodeError } from './emailCode';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { buildOAuthCallbackUrl } from '@/lib/authRedirect';
import { returnToSignIn } from '@/lib/authNavigation';
import { clearInvitationSession } from '@/lib/invitations/session';
import { getInvitationReturnPath } from '@/lib/invitations/contracts';
import { tripRepository } from '@/lib/tripRepository';

// ── Context shape ─────────────────────────────────────────────────────────────
interface AuthContextValue {
  user: User | null;
  identity: { userId: string; source: 'online' | 'local' } | null;
  isLoading: boolean;
  operation: 'google' | 'request' | 'verify' | 'signout' | null;
  emailChallenge: { email: string; sentAt: number } | null;
  requestEmailCode: (email: string) => Promise<void>;
  verifyEmailCode: (email: string, code: string) => Promise<void>;
  changeEmail: () => void;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  switchInvitationAccount: (invitationPath: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  identity: null,
  isLoading: true,
  operation: null,
  emailChallenge: null,
  requestEmailCode: async () => { throw new Error('Email sign-in is unavailable.'); },
  verifyEmailCode: async () => { throw new Error('Email sign-in is unavailable.'); },
  changeEmail: () => {},
  signIn: async () => {},
  signOut: async () => {},
  switchInvitationAccount: async () => {},
});

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({
  children,
  initialOfflineUserId,
}: {
  children: React.ReactNode;
  initialOfflineUserId?: string;
}) {
  const router = useRouter();
  const lock = useRef<AuthContextValue['operation']>(null);
  const [operation, setOperation] = useState<AuthContextValue['operation']>(null);
  const [emailChallenge, setEmailChallenge] = useState<AuthContextValue['emailChallenge']>(null);
  const challenge = useRef<AuthContextValue['emailChallenge']>(null);
  const revision = useRef(0);
  const currentUserId = useRef<string | null>(null);
  const run = useCallback(async (kind: NonNullable<AuthContextValue['operation']>, action: () => Promise<void>) => {
    if (lock.current) throw new Error('Another sign-in action is still in progress. Please wait.');
    lock.current = kind;
    setOperation(kind);
    try { await action(); }
    finally { lock.current = null; setOperation(null); }
  }, []);
  const [user, setUser] = useState<User | null>(null);
  const [identity, setIdentity] = useState<AuthContextValue['identity']>(() =>
    initialOfflineUserId
      ? { userId: initialOfflineUserId, source: 'local' }
      : null
  );
  const [isLoading, setIsLoading] = useState(!initialOfflineUserId);

  useEffect(() => {
    if (initialOfflineUserId) return;
    let cancelled = false;
    const hydrationRevision = revision.current;
    const stale = () => cancelled || hydrationRevision !== revision.current;

    async function loadSavedIdentity() {
      const cached = await tripRepository.readOfflineTrip();
      if (stale()) return;
      if (cached.identity) {
        setIdentity({ userId: cached.identity.activeUserId, source: 'local' });
      } else {
        setIdentity(null);
      }
      setIsLoading(false);
    }

    // Hydrate from existing session
    void supabase.auth
      .getUser()
      .then(async ({ data, error }) => {
        if (stale()) return;
        if (error) {
          await loadSavedIdentity();
          return;
        }
        const verifiedUser = data.user ?? null;
        currentUserId.current = verifiedUser?.id ?? null;
        setUser(verifiedUser);
        setIdentity(
          verifiedUser ? { userId: verifiedUser.id, source: 'online' } : null
        );
        if (!verifiedUser) await tripRepository.clearOfflineIdentity();
        if (!stale()) setIsLoading(false);
      })
      .catch(() => loadSavedIdentity());

    // Listen for sign in / sign out events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // INITIAL_SESSION comes from local storage; getUser still verifies it online.
      if (cancelled || event === 'INITIAL_SESSION') return;
      revision.current++;
      const nextUser = session?.user ?? null;
      const previousId = currentUserId.current;
      currentUserId.current = nextUser?.id ?? null;
      if (previousId && previousId !== nextUser?.id) {
        void tripRepository.clearUserCache({ userId: previousId }).catch(() => {});
      }
      setUser(nextUser);
      setIdentity(nextUser ? { userId: nextUser.id, source: 'online' } : null);
      if (event === 'SIGNED_OUT') void tripRepository.clearOfflineIdentity();
      if (nextUser) { challenge.current = null; setEmailChallenge(null); }
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [initialOfflineUserId]);

  const signIn = useCallback(() => run('google', async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: buildOAuthCallbackUrl(window.location),
      },
    });

    if (error) throw error;
  }), [run]);

  const requestEmailCode = useCallback((input: string) => run('request', async () => {
    if (!emailCodeSignInEnabled()) throw new Error('Email sign-in is unavailable.');
    const email = input.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
    if (challenge.current && Date.now() - challenge.current.sentAt < 60_000) {
      throw new Error('Wait a minute before requesting another code.');
    }
    try {
      const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
      if (error) throw error;
      challenge.current = { email, sentAt: Date.now() };
      setEmailChallenge(challenge.current);
    } catch (error) { throw emailCodeError(error, 'request'); }
  }), [run]);

  const verifyEmailCode = useCallback((email: string, code: string) => run('verify', async () => {
    if (!emailCodeSignInEnabled()) throw new Error('Email sign-in is unavailable.');
    if (!/^\d{6}$/.test(code)) throw new Error('Enter the six-digit code.');
    try {
      const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
      if (error || !data.session) throw error ?? new Error();
      // The shared SSR browser client has written the session cookies by this point.
      // Auth events remain authoritative even if the dialog was dismissed.
      router.refresh();
      challenge.current = null;
      setEmailChallenge(null);
    } catch (error) { throw emailCodeError(error, 'verify'); }
  }), [router, run]);

  const changeEmail = useCallback(() => {
    if (lock.current) return;
    challenge.current = null;
    setEmailChallenge(null);
  }, []);

  const clearSession = useCallback((invitationPath?: string) => run('signout', async () => {
    revision.current++;
    if (!invitationPath) clearInvitationSession();
    let signedOut = false;
    try {
      const userId = user?.id ?? identity?.userId;
      if (userId) {
        try {
          await tripRepository.clearUserCache({ userId });
        } catch (error) {
          console.error('[auth] Cached trip data could not be cleared.', error);
        }
      }
      try {
        await tripRepository.clearOfflineIdentity();
      } catch (error) {
        console.error('[auth] Offline identity pointer could not be cleared.', error);
      }
      const { error } = await supabase.auth.signOut(invitationPath ? { scope: 'local' } : undefined);
      if (invitationPath && error) throw new Error('Account switch could not be completed.');
      signedOut = true;
    } finally {
      if (!invitationPath || signedOut) {
        setUser(null);
        setIdentity(null);
        if (invitationPath) returnToSignIn(invitationPath);
        else returnToSignIn();
      }
    }
  }), [identity, user, run]);

  const signOut = useCallback(() => clearSession(), [clearSession]);
  const switchInvitationAccount = useCallback((path: string) => {
    const destination = getInvitationReturnPath(path);
    if (!destination) return Promise.reject(new Error('Invalid invitation destination.'));
    return clearSession(destination);
  }, [clearSession]);

  return (
    <AuthContext.Provider value={{ user, identity, isLoading: isLoading || operation === 'verify', operation, emailChallenge, requestEmailCode, verifyEmailCode, changeEmail, signIn, signOut, switchInvitationAccount }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useAuth() {
  return useContext(AuthContext);
}
