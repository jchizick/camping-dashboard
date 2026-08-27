import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database';
import { requiredEnvironmentVariable } from '@/lib/env';

function isProtectedPage(pathname: string) {
  return pathname === '/trips/new' || pathname.startsWith('/trips/');
}

function copyResponseCookies(source: NextResponse, destination: NextResponse) {
  source.cookies.getAll().forEach((cookie) => destination.cookies.set(cookie));
}

export async function updateSupabaseSession(request: NextRequest) {
  if (
    request.nextUrl.pathname === '/auth/callback' ||
    request.nextUrl.pathname === '/offline' ||
    request.nextUrl.pathname === '/sw.js' ||
    request.nextUrl.pathname === '/manifest.webmanifest'
  ) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  let refreshedSession = false;
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
          refreshedSession = true;
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: claimsData } = await supabase.auth.getClaims();

  if (!claimsData?.claims && isProtectedPage(request.nextUrl.pathname)) {
    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = '/trips';
    signInUrl.search = '';
    signInUrl.searchParams.set(
      'next',
      `${request.nextUrl.pathname}${request.nextUrl.search}`
    );
    const redirect = NextResponse.redirect(signInUrl);
    copyResponseCookies(response, redirect);
    redirect.headers.set('Cache-Control', 'private, no-store');
    return redirect;
  }

  if (refreshedSession || isProtectedPage(request.nextUrl.pathname)) {
    response.headers.set('Cache-Control', 'private, no-store');
  }

  return response;
}
