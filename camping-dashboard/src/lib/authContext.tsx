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

// ── Context shape ─────────────────────────────────────────────────────────────
interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  signIn: async () => {},
  signOut: async () => {},
});

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Hydrate from existing session
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setIsLoading(false);
    });

    // Listen for sign in / sign out events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useAuth() {
  return useContext(AuthContext);
}
