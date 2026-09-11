// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import { captureInvitationSession, clearInvitationSession, INVITATION_RECOVERY_MS } from './session';
import { buildOAuthCallbackUrl, getSafeNextPath } from '../authRedirect';

const token = 'A'.repeat(43);
beforeEach(() => {
  sessionStorage.clear();
  window.opener = null;
  history.replaceState({ preserved: true }, '', '/invite');
});

it('captures a fresh fragment, replaces URL without adding history, and resumes on reload/auth return', () => {
  history.replaceState({ preserved: true }, '', '/invite#' + token);
  const length = history.length;
  expect(captureInvitationSession()).toBe(token);
  expect(location.pathname + location.search + location.hash).toBe('/invite');
  expect(history.length).toBe(length); expect(history.state).toEqual({ preserved: true });
  const callback = new URL(buildOAuthCallbackUrl(location));
  expect(callback.searchParams.get('next')).toBe('/invite');
  expect(callback.href).not.toContain(token);
  expect(captureInvitationSession()).toBe(token);
  clearInvitationSession(); expect(captureInvitationSession()).toBeNull();
});
it.each(['#bad', '#' + 'B'.repeat(43), '#%41' + 'A'.repeat(42)])('rejects malformed fragment and removes stale token: %s', fragment => {
  history.replaceState({}, '', '/invite#' + token); captureInvitationSession();
  history.replaceState({}, '', '/invite' + fragment);
  expect(captureInvitationSession()).toBeNull(); expect(location.hash).toBe('');
  expect(sessionStorage.length).toBe(0);
});
it('plain unrelated tab is empty; opener-cloned storage is discarded, but an explicit fresh link works', () => {
  expect(captureInvitationSession()).toBeNull();
  history.replaceState({}, '', '/invite#' + token); captureInvitationSession();
  window.opener = {}; // Simulate browser-cloned storage from opener.
  expect(captureInvitationSession()).toBeNull(); expect(window.opener).toBeNull();
  window.opener = {};
  history.replaceState({}, '', '/invite#' + token);
  expect(captureInvitationSession()).toBe(token);
  expect(captureInvitationSession()).toBe(token);
});
it('bounds recovery lifetime without extending it on reload', () => {
  const now = Date.now(); vi.spyOn(Date, 'now').mockReturnValue(now);
  history.replaceState({}, '', '/invite#' + token); captureInvitationSession();
  vi.mocked(Date.now).mockReturnValue(now + INVITATION_RECOVERY_MS - 1);
  expect(captureInvitationSession()).toBe(token);
  vi.mocked(Date.now).mockReturnValue(now + INVITATION_RECOVERY_MS);
  expect(captureInvitationSession()).toBeNull(); expect(sessionStorage.length).toBe(0);
});
it('fails closed when storage is unavailable and still cleans the URL', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  history.replaceState({}, '', '/invite#' + token);
  expect(captureInvitationSession()).toBeNull(); expect(location.hash).toBe('');
});
it('fails closed without exposing errors when URL cleanup fails', () => {
  history.replaceState({}, '', '/invite#' + token);
  vi.spyOn(history, 'replaceState').mockImplementation(() => { throw new Error(token); });
  expect(captureInvitationSession()).toBeNull(); expect(sessionStorage.length).toBe(0);
});
it.each(['/invite/'+token, '/invite#'+token, '/invite?token='+token, '/%69nvite/'+token, '/invite%2f'+token])('rejects token-bearing OAuth return %s', next => {
  expect(getSafeNextPath(next)).toBeNull();
  const callback = buildOAuthCallbackUrl({ origin:'https://app.test', pathname:'/trips', search:'?next='+encodeURIComponent(next) });
  expect(callback).not.toContain(token);
});

it('rejects token-bearing nested next while preserving normal trip query/hash',()=>{
  const unsafe='/trips?next='+encodeURIComponent('/invite#'+token);
  expect(getSafeNextPath(unsafe)).toBeNull();
  expect(getSafeNextPath('/trips/a/gear?intent=pack#item')).toBe('/trips/a/gear?intent=pack#item');
});
