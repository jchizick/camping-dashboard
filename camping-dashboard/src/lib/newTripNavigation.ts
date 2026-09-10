import { getSafeNextPath } from './authRedirect';

/** Only canonical workspace paths; no query, hash, encoded separators or dot segments. */
export function getNewTripOrigin(value: string | null): string | null {
  if (!value || !/^\/trips\/(?!new(?:\/|$))[A-Za-z0-9_-]+(?:\/(?:plan|gear|crew|guide|field-log))?$/.test(value)) return null;
  return getSafeNextPath(value) === value ? value : null;
}

export function newTripHref(pathname: string): string {
  const origin = getNewTripOrigin(pathname);
  return origin ? `/trips/new?${new URLSearchParams({ from: origin })}` : '/trips/new';
}
