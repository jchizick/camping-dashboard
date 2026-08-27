'use client';

// ============================================================
// authContext.tsx — Auth state provider for the dashboard
// Tracks signed-in user via Supabase Google OAuth.
// No email whitelists — authorization is handled by trip_members
// and the TripProvider in tripContext.tsx.
// ============================================================

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { buildOAuthCallbackUrl } from '@/lib/authRedirect';
import { returnToSignIn } from '@/lib/authNavigation';
import { tripRepository } from '@/lib/tripRepository';

// ── Context shape ─────────────────────────────────────────────────────────────
interface AuthContextValue {
  user: User | null;
  identity: { userId: string; source: 'online' | 'local' } | null;
  isLoading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  identity: null,
  isLoading: true,
  signIn: async () => {},
  signOut: async () => {},
});

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({
  children,
  initialOfflineUserId,
}: {
  children: React.ReactNode;
  initialOfflineUserId?: string;
}) {
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

    async function loadSavedIdentity() {
      const cached = await tripRepository.readOfflineTrip();
      if (cancelled) return;
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
        if (cancelled) return;
        if (error) {
          await loadSavedIdentity();
          return;
        }
        const verifiedUser = data.user ?? null;
        setUser(verifiedUser);
        setIdentity(
          verifiedUser ? { userId: verifiedUser.id, source: 'online' } : null
        );
        if (!verifiedUser) await tripRepository.clearOfflineIdentity();
        setIsLoading(false);
      })
      .catch(() => loadSavedIdentity());

    // Listen for sign in / sign out events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      setUser(session?.user ?? null);
      if (event === 'SIGNED_OUT') {
        setIdentity(null);
        void tripRepository.clearOfflineIdentity();
      } else if (session?.user) {
        setIdentity((current) =>
          current?.source === 'online'
            ? current
            : { userId: session.user.id, source: 'local' }
        );
      }
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [initialOfflineUserId]);

  const signIn = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: buildOAuthCallbackUrl(window.location),
      },
    });

    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
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
      await supabase.auth.signOut();
    } finally {
      setUser(null);
      setIdentity(null);
      returnToSignIn();
    }
  }, [identity, user]);

  return (
    <AuthContext.Provider value={{ user, identity, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useAuth() {
  return useContext(AuthContext);
}
