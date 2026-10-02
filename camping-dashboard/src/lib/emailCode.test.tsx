// @vitest-environment jsdom
import React, { useState, useEffect } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), otp: vi.fn(), verify: vi.fn(), google: vi.fn(), signOut: vi.fn(), refresh: vi.fn(), clear: vi.fn(), offline: vi.fn(), listener: undefined as undefined | ((event: AuthChangeEvent, session: Session | null) => void) }));
vi.mock('./supabase', () => ({ supabase: { auth: {
  getUser: mocks.getUser, signInWithOtp: mocks.otp, verifyOtp: mocks.verify, signInWithOAuth: mocks.google, signOut: mocks.signOut,
  onAuthStateChange: (listener: typeof mocks.listener) => { mocks.listener = listener; return { data: { subscription: { unsubscribe: vi.fn() } } }; },
} } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock('./authNavigation', () => ({ returnToSignIn: vi.fn() }));
vi.mock('./tripRepository', () => ({ tripRepository: { readOfflineTrip: mocks.offline, clearOfflineIdentity: vi.fn().mockResolvedValue(undefined), clearUserCache: mocks.clear } }));
import { AuthProvider, useAuth } from './authContext';
import { EmailCodeDialog } from '@/components/auth/EmailCodeDialog';
import { emailCodeError } from './emailCode';
let auth: ReturnType<typeof useAuth>;
function Harness() {
  const value = useAuth();
  useEffect(() => { auth = value; }, [value]);
  const [open, setOpen] = useState(false);
  return <><p data-testid="identity">{value.identity?.userId ?? 'none'}</p><button onClick={() => setOpen(true)}>Open email</button><EmailCodeDialog open={open} onClose={() => setOpen(false)} /></>;
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
const session = (id: string) => ({ user: { id } } as Session);
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_EMAIL_CODE_SIGN_IN_ENABLED', 'true');
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
  mocks.otp.mockResolvedValue({ error: null }); mocks.google.mockResolvedValue({ error: null }); mocks.signOut.mockResolvedValue({ error: null });
  mocks.clear.mockResolvedValue(undefined); mocks.offline.mockResolvedValue({ identity: null });
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });
async function setup() { render(<AuthProvider><Harness /></AuthProvider>); await waitFor(() => expect(auth.isLoading).toBe(false)); }

it('gates both helpers and the dialog when disabled', async () => {
  vi.stubEnv('NEXT_PUBLIC_EMAIL_CODE_SIGN_IN_ENABLED', 'false'); await setup();
  await act(async () => { await expect(auth.requestEmailCode('camper@example.test')).rejects.toThrow('unavailable'); await expect(auth.verifyEmailCode('camper@example.test', '000000')).rejects.toThrow('unavailable'); });
  fireEvent.click(screen.getByText('Open email'));
  expect(screen.queryByRole('dialog')).toBeNull(); expect(mocks.otp).not.toHaveBeenCalled(); expect(mocks.verify).not.toHaveBeenCalled();
});
it('requests signup-capable codes without redirect metadata or invitation tokens and enforces cooldown', async () => {
  await setup(); await act(async () => { await auth.requestEmailCode(' camper@example.test '); });
  expect(mocks.otp).toHaveBeenCalledWith({ email: 'camper@example.test', options: { shouldCreateUser: true } });
  await act(async () => { await expect(auth.requestEmailCode('camper@example.test')).rejects.toThrow('Wait a minute'); });
  expect(mocks.otp).toHaveBeenCalledTimes(1);
});
it('rejects duplicate and conflicting operations synchronously instead of queuing', async () => {
  await setup(); const pending = deferred<{ error: null }>(); mocks.otp.mockReturnValue(pending.promise);
  await act(async () => {
    const first = auth.requestEmailCode('camper@example.test');
    await expect(auth.requestEmailCode('camper@example.test')).rejects.toThrow('in progress');
    await expect(auth.signIn()).rejects.toThrow('in progress');
    await expect(auth.signOut()).rejects.toThrow('in progress');
    await expect(auth.switchInvitationAccount('/invite')).rejects.toThrow('in progress');
    pending.resolve({ error: null }); await first;
  });
  expect(mocks.otp).toHaveBeenCalledTimes(1); expect(mocks.google).not.toHaveBeenCalled(); expect(mocks.signOut).not.toHaveBeenCalled();
});
it('keeps verification locked after dismissal, reconciles the real event, then refreshes cookies before continuation', async () => {
  await setup(); await act(async () => { await auth.requestEmailCode('camper@example.test'); });
  fireEvent.click(screen.getByText('Open email'));
  const pending = deferred<{ data: { session: Session }; error: null }>(); mocks.verify.mockReturnValue(pending.promise);
  fireEvent.change(screen.getByLabelText('Six-digit code'), { target: { value: '000000' } });
  fireEvent.submit(screen.getByLabelText('Six-digit code').closest('form')!);
  expect(auth.operation).toBe('verify');
  fireEvent.click(screen.getByLabelText('Close email sign-in'));
  expect(screen.queryByRole('dialog')).toBeNull();
  fireEvent.click(screen.getByText('Open email'));
  expect(screen.getByText('Verifying…').hasAttribute('disabled')).toBe(true);
  expect(screen.getByText('Change email').hasAttribute('disabled')).toBe(true);
  await act(async () => {
    auth.changeEmail(); expect(auth.emailChallenge).not.toBeNull();
    await expect(auth.signIn()).rejects.toThrow('in progress');
    await expect(auth.switchInvitationAccount('/invite')).rejects.toThrow('in progress');
    mocks.listener!('SIGNED_IN', session('email-user'));
  });
  expect(auth.isLoading).toBe(true); expect(mocks.refresh).not.toHaveBeenCalled();
  await act(async () => { pending.resolve({ data: { session: session('email-user') }, error: null }); });
  expect(auth.identity?.userId).toBe('email-user'); expect(auth.operation).toBeNull(); expect(mocks.refresh).toHaveBeenCalledOnce();
});
it('does not show a stale request error after dismissal and reopening', async () => {
  await setup(); const pending = deferred<{ error: { status: number } }>(); mocks.otp.mockReturnValue(pending.promise);
  fireEvent.click(screen.getByText('Open email'));
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'camper@example.test' } });
  fireEvent.submit(screen.getByLabelText('Email address').closest('form')!);
  fireEvent.click(screen.getByLabelText('Close email sign-in')); fireEvent.click(screen.getByText('Open email'));
  await act(async () => { pending.resolve({ error: { status: 500 } }); });
  expect(screen.queryByRole('alert')).toBeNull(); expect(auth.operation).toBeNull();
});
it('ignores late hydration after a new session and replaces an existing online identity', async () => {
  const old = deferred<{ data: { user: { id: string } }; error: null }>(); mocks.getUser.mockReturnValue(old.promise);
  render(<AuthProvider><Harness /></AuthProvider>);
  await act(async () => { mocks.listener!('SIGNED_IN', session('first')); mocks.listener!('SIGNED_IN', session('second')); old.resolve({ data: { user: { id: 'old' } }, error: null }); });
  expect(auth.identity?.userId).toBe('second'); expect(mocks.clear).toHaveBeenCalledWith({ userId: 'first' });
});
it('discards late offline hydration after authentication', async () => {
  const offline = deferred<{ identity: { activeUserId: string } }>(); mocks.offline.mockReturnValue(offline.promise);
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: { status: 0 } });
  render(<AuthProvider><Harness /></AuthProvider>); await waitFor(() => expect(mocks.offline).toHaveBeenCalled());
  await act(async () => { mocks.listener!('SIGNED_IN', session('new')); offline.resolve({ identity: { activeUserId: 'old' } }); });
  expect(auth.identity?.userId).toBe('new');
});
it('switches only the current session', async () => {
  await setup(); await act(async () => { await auth.switchInvitationAccount('/invite'); });
  expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' });
});
it.each([
  [{ status: 429 }, 'Too many attempts'], [{ code: 'otp_expired' }, 'invalid or expired'],
  [{ name: 'AuthRetryableFetchError' }, 'connection'], [{ message: 'private provider detail' }, 'could not'],
])('returns neutral actionable errors without raw provider messages', (error, expected) => {
  expect(emailCodeError(error, 'verify').message).toContain(expected);
  expect(emailCodeError(error, 'request').message).not.toContain('private provider detail');
});

it('supports code paste, change email, and resend after the UX cooldown', async () => {
  await setup(); await act(async () => { await auth.requestEmailCode('camper@example.test'); });
  fireEvent.click(screen.getByText('Open email'));
  fireEvent.change(screen.getByLabelText('Six-digit code'), { target: { value: '000 000' } });
  expect((screen.getByLabelText('Six-digit code') as HTMLInputElement).value).toBe('000000');
  fireEvent.change(screen.getByLabelText('Six-digit code'), { target: { value: '123-4567' } });
  expect((screen.getByLabelText('Six-digit code') as HTMLInputElement).value).toBe('123456');
  expect(screen.getByLabelText('Six-digit code').getAttribute('autocomplete')).toBe('one-time-code');
  const time = Date.now(); vi.spyOn(Date, 'now').mockReturnValue(time + 61_000);
  await act(async () => { await auth.requestEmailCode('camper@example.test'); });
  expect(mocks.otp).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByText('Change email'));
  expect(screen.getByLabelText('Email address')).toBeTruthy(); expect(auth.emailChallenge).toBeNull();
});
it('rejects malformed input before calling Supabase', async () => {
  await setup();
  await act(async () => { await expect(auth.requestEmailCode('invalid')).rejects.toThrow('valid email'); await expect(auth.verifyEmailCode('camper@example.test', 'x')).rejects.toThrow('six-digit'); });
  expect(mocks.otp).not.toHaveBeenCalled(); expect(mocks.verify).not.toHaveBeenCalled();
});

it('contains keyboard focus and restores the opening control on dismissal', async () => {
  await setup(); const trigger = screen.getByText('Open email'); trigger.focus(); fireEvent.click(trigger);
  const submit = screen.getByRole('button', { name: 'Send code' }); const close = screen.getByLabelText('Close email sign-in');
  submit.focus(); fireEvent.keyDown(submit, { key: 'Tab' }); expect(document.activeElement).toBe(close);
  fireEvent.keyDown(close, { key: 'Tab', shiftKey: true }); expect(document.activeElement).toBe(submit);
  fireEvent.click(close); expect(document.activeElement).toBe(trigger);
});

it('never displays more than 60 seconds when issuance completes between timer ticks', async () => {
  await setup();
  const clock = vi.spyOn(Date, 'now').mockReturnValue(100_000);
  fireEvent.click(screen.getByText('Open email'));
  const pending = deferred<{ error: null }>(); mocks.otp.mockReturnValue(pending.promise);
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'camper@example.test' } });
  fireEvent.submit(screen.getByLabelText('Email address').closest('form')!);
  clock.mockReturnValue(100_900);
  await act(async () => { pending.resolve({ error: null }); });
  expect(screen.getByRole('button', { name: 'Resend in 60s' }).hasAttribute('disabled')).toBe(true);
  expect(screen.queryByRole('button', { name: 'Resend in 61s' })).toBeNull();
});
