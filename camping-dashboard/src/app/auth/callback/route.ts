// ============================================================
// /auth/callback/route.ts — Supabase Google OAuth callback
// After Google redirects, this exchanges the auth `code`
// for a Supabase session and stores it in cookies.
// ============================================================

import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/types/database';
import { getSafeNextPath } from '@/lib/authRedirect';
import { requiredEnvironmentVariable } from '@/lib/env';
import { type NextRequest, NextResponse } from 'next/server';

type AuthErrorCode =
  | 'cancelled'
  | 'exchange_failed'
  | 'invalid_redirect'
  | 'missing_code'
  | 'provider_error';

function redirectResponse(
  requestUrl: URL,
  destination: string
) {
  const redirectUrl = new URL(destination, requestUrl.origin);

  const response = NextResponse.redirect(redirectUrl);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

function errorRedirectResponse(
  requestUrl: URL,
  errorCode: AuthErrorCode,
  next?: string
) {
  const response = redirectResponse(requestUrl, '/trips');
  const redirectUrl = new URL('/trips', requestUrl.origin);
  redirectUrl.searchParams.set('auth_error', errorCode);
  if (next && next !== '/trips') redirectUrl.searchParams.set('next', next);
  response.headers.set('location', redirectUrl.toString());
  return response;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const requestedNext = requestUrl.searchParams.get('next');
  const next = requestedNext === null ? '/trips' : getSafeNextPath(requestedNext);

  if (!next) {
    return errorRedirectResponse(requestUrl, 'invalid_redirect');
  }

  const providerError = requestUrl.searchParams.get('error');
  if (providerError) {
    return errorRedirectResponse(
      requestUrl,
      providerError === 'access_denied' ? 'cancelled' : 'provider_error',
      next
    );
  }

  if (!code) {
    return errorRedirectResponse(requestUrl, 'missing_code', next);
  }

  const response = redirectResponse(requestUrl, next);
  const supabase = createServerClient<Database>(
    requiredEnvironmentVariable(
      'NEXT_PUBLIC_SUPABASE_URL',
      process.env.NEXT_PUBLIC_SUPABASE_URL
    ),
    requiredEnvironmentVariable(
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[auth/callback] Supabase code exchange failed.');
    }

    const errorResponse = errorRedirectResponse(requestUrl, 'exchange_failed', next);
    response.headers.set('location', errorResponse.headers.get('location') ?? '/trips');
  }

  return response;
}
