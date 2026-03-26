'use client';

// ============================================================
// authContext.tsx — Auth state provider for the dashboard
// Tracks signed-in user via Supabase Google OAuth.
// Only whitelisted emails are considered "authorized" for
// mutation actions; all others get read-only access.
// ============================================================

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

// ── Whitelist ─────────────────────────────────────────────────────────────────
const WHITELISTED_EMAILS = [
  'esheridan9@gmail.com',
  'jordanlanechizick@gmail.com',
];

// ── Context shape ─────────────────────────────────────────────────────────────
interface AuthContextValue {
  user: User | null;
  isAuthorized: boolean;
  isLoading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isAuthorized: false,
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

  const isAuthorized = WHITELISTED_EMAILS.includes(user?.email ?? '');

  return (
    <AuthContext.Provider value={{ user, isAuthorized, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useAuth() {
  return useContext(AuthContext);
}
