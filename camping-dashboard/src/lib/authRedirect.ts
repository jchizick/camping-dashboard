const DEFAULT_AUTH_DESTINATION = '/trips';
const SAFE_REDIRECT_ORIGIN = 'https://app.invalid';

export function getSafeNextPath(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return null;
  }

  let decodedValue: string;
  try {
    decodedValue = decodeURIComponent(value);
  } catch {
    return null;
  }

  if (
    decodedValue.startsWith('//') ||
    decodedValue.includes('\\') ||
    /[\u0000-\u001f\u007f]/.test(decodedValue)
  ) {
    return null;
  }

  const url = new URL(value, SAFE_REDIRECT_ORIGIN);
  if (url.origin !== SAFE_REDIRECT_ORIGIN) {
    return null;
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

export function getRequestedAuthDestination(
  searchParams: Pick<URLSearchParams, 'get'>
): string {
  return getSafeNextPath(searchParams.get('next')) ?? DEFAULT_AUTH_DESTINATION;
}

export function buildOAuthCallbackUrl(location: Pick<Location, 'origin' | 'pathname' | 'search'>) {
  const pageParams = new URLSearchParams(location.search);
  const requestedDestination =
    getSafeNextPath(pageParams.get('next')) ??
    getSafeNextPath(
      location.pathname === DEFAULT_AUTH_DESTINATION
        ? DEFAULT_AUTH_DESTINATION
        : `${location.pathname}${location.search}`
    ) ??
    DEFAULT_AUTH_DESTINATION;
  const callbackUrl = new URL('/auth/callback', location.origin);

  callbackUrl.searchParams.set('next', requestedDestination);
  return callbackUrl.toString();
}

export function getAuthErrorMessage(code: string | null): string | null {
  switch (code) {
    case 'cancelled':
      return 'Google sign-in was cancelled. You can try again when you are ready.';
    case 'missing_code':
    case 'provider_error':
    case 'exchange_failed':
      return 'Google sign-in could not be completed. Please try again.';
    case 'invalid_redirect':
      return 'The requested destination was invalid. Please sign in again.';
    default:
      return null;
  }
}
