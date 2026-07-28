'use client';

import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getRequestedAuthDestination } from '@/lib/authRedirect';
import { supabase } from '@/lib/supabase';

export default function DevLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setErrorMessage('Sign-in failed. Check the QA account credentials and try again.');
        setIsSubmitting(false);
        return;
      }

      router.replace(getRequestedAuthDestination(searchParams));
      router.refresh();
    } catch {
      setErrorMessage('Sign-in failed. Check the QA account credentials and try again.');
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-app-bg px-5 py-12 font-sans text-text-main">
      <section
        aria-labelledby="dev-login-title"
        className="mx-auto max-w-md rounded-2xl border border-border-subtle bg-card-bg p-6 shadow-card sm:p-8"
      >
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-accent-yellow">
          Local development
        </p>
        <h1 id="dev-login-title" className="text-2xl font-bold tracking-tight">
          QA account sign-in
        </h1>
        <p className="mt-2 text-sm leading-6 text-text-muted">
          Sign in with an existing Supabase email and password account.
        </p>

        <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="dev-login-email">
              Email
            </label>
            <input
              id="dev-login-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-border-subtle bg-app-bg px-3 py-2.5 text-sm outline-none transition focus:border-accent-yellow focus:ring-2 focus:ring-accent-yellow/25"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="dev-login-password">
              Password
            </label>
            <input
              id="dev-login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-border-subtle bg-app-bg px-3 py-2.5 text-sm outline-none transition focus:border-accent-yellow focus:ring-2 focus:ring-accent-yellow/25"
            />
          </div>

          {errorMessage && (
            <p
              role="alert"
              className="rounded-lg border border-accent-red/30 bg-accent-red/10 p-3 text-sm text-accent-red"
            >
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex w-full items-center justify-center rounded-lg bg-accent-yellow px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-wait disabled:opacity-65"
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  );
}
