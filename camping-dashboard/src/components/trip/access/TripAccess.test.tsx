// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PhoneLayoutProvider } from '../PhoneLayoutProvider';
import { TripAccessInvite, TripAccessProvider } from './TripAccessProvider';
import TripMoreMenu from '../TripMoreMenu';
import { retryDelay } from './useTripAccessManagement';
import { formatAccessExpiry } from './TripAccessSheet';
vi.mock('@/lib/authContext', () => ({ useAuth: () => ({ user: null, identity: null }) }));
vi.mock('next/navigation', () => ({ usePathname: () => '/trips/demo' }));
const initial = () => ({ people: [
  { membershipId: 'owner', email: 'owner@example.test', role: 'owner', isCurrentUser: true },
  { membershipId: 'viewer', email: null, role: 'viewer', isCurrentUser: false },
], pendingInvitations: [{ invitationId: 'pending', email: 'long.pending.person@example.test', role: 'editor', status: 'pending', createdAt: '2026-09-01', expiresAt: '2026-09-20' }] });
let snapshot = initial();
let available = true;
let readStatus = 200;
let result: Record<string, unknown>;
let status = 200;
let retry: string | undefined;
let holdRead: Promise<void> | undefined;
let holdMutation: Promise<void> | undefined;
let calls: Record<string, unknown>[];
beforeEach(() => {
  snapshot = initial(); available = true; readStatus = 200; status = 200; retry = undefined;
  holdRead = undefined; holdMutation = undefined; result = { delivery: 'sent' }; calls = [];
  vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
    if (!options?.body) return new Response(JSON.stringify({ tripAccessAvailable: available }));
    const body = JSON.parse(options.body); calls.push(body);
    if (body.operation === 'list_access') { await holdRead; return new Response(JSON.stringify(readStatus === 200 ? snapshot : { code: 'internal_secret' }), { status: readStatus }); }
    await holdMutation;
    if (status === 200 && body.operation === 'remove_access') snapshot.people = snapshot.people.filter(p => p.membershipId !== body.membershipId);
    if (status === 200 && body.operation === 'revoke') snapshot.pendingInvitations = [];
    return new Response(JSON.stringify(result), { status, headers: retry ? { 'Retry-After': retry } : {} });
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });
function mount(eligible = true, phone = false) {
  vi.stubGlobal('matchMedia', () => ({ matches: phone, addEventListener() {}, removeEventListener() {} }));
  return render(<PhoneLayoutProvider><TripAccessProvider tripId="demo" eligible={eligible}>
    {phone ? <TripMoreMenu id="more" mobile tripId="demo" onProjectIntel={() => {}} onSignOut={async () => {}} /> : <TripAccessInvite />}
  </TripAccessProvider></PhoneLayoutProvider>);
}
async function open(phone = false) {
  mount(true, phone);
  if (phone) { await act(async () => {}); fireEvent.click(screen.getByRole('button', { name: 'More trip actions' })); }
  const trigger = await screen.findByRole('button', { name: phone ? 'Trip access' : 'Invite' }); trigger.focus(); fireEvent.click(trigger);
  await screen.findByRole('dialog', { name: 'Trip access' });
  return trigger;
}
async function populated() { await open(); await screen.findByText('owner@example.test'); }
function submit() { fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.test' } }); fireEvent.submit(screen.getByRole('button', { name: 'Send invite' }).closest('form')!); }
describe('Owner Trip Access', () => {
  it('formats expiry using the chosen locale and omits invalid dates', () => {
    expect(formatAccessExpiry('2026-09-20T18:00:00Z', 'en-US')).toBe('Sep 20');
    expect(formatAccessExpiry('2026-09-20T18:00:00Z', 'en-GB')).toBe('20 Sept');
    expect(formatAccessExpiry('invalid')).toBeNull();
  });
  it('shows semantic expiry metadata and marks only destructive actions', async () => {
    await populated();
    expect(document.querySelector('time')?.getAttribute('datetime')).toBe('2026-09-20');
    expect(document.querySelector('time')?.textContent).toContain('Expires ');
    expect(screen.getByRole('button', { name: /Resend/ }).classList.contains('trip-access-destructive')).toBe(false);
    expect(screen.getByRole('button', { name: /Revoke/ }).classList.contains('trip-access-destructive')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /Remove access/ }));
    expect(screen.getByRole('button', { name: 'Remove access' }).classList.contains('trip-access-destructive')).toBe(true);
  });
  it('opens from Invite, defaults Viewer, renders safe roster, and returns focus on Escape', async () => {
    const trigger = await open(); await screen.findByText('owner@example.test');
    expect((screen.getByLabelText('Role') as HTMLSelectElement).value).toBe('viewer');
    expect(screen.getByText('Owner · You')).toBeTruthy(); expect(screen.getByText('Unknown member')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /Remove access/ })).toHaveLength(1);
    expect(screen.getByText(/Editor · Pending/)).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' }); expect(screen.queryByRole('dialog')).toBeNull(); expect(document.activeElement).toBe(trigger);
  });
  it.each(['Viewer', 'Editor', 'offline Owner'])('hides all UI and requests for ineligible %s', async () => {
    mount(false); await act(async () => {}); expect(screen.queryByRole('button')).toBeNull(); expect(fetch).not.toHaveBeenCalled();
  });
  it.each([false, true])('fails closed with availability false on phone=%s', async phone => {
    available = false; mount(true, phone); await act(async () => {});
    if (phone) fireEvent.click(screen.getByRole('button', { name: 'More trip actions' }));
    expect(screen.queryByRole('button', { name: /^(Invite|Trip access)$/ })).toBeNull(); expect(calls).toEqual([]);
  });
  it('fails closed on availability network failure', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('private detail')); mount(); await act(async () => {}); expect(screen.queryByRole('button')).toBeNull();
  });
  it('opens immediately with a loading state then supports safe read retry', async () => {
    let finish!: () => void; holdRead = new Promise(resolve => { finish = resolve; }); readStatus = 500;
    await open(); expect(screen.getByText('Loading trip access…')).toBeTruthy();
    await act(async () => finish()); expect(await screen.findByRole('alert')).toBeTruthy(); expect(screen.queryByText('internal_secret')).toBeNull();
    readStatus = 200; fireEvent.click(screen.getByRole('button', { name: 'Retry loading access' })); await screen.findByText('owner@example.test');
  });
  it('selects Editor, sends only the actual API fields, resets and refreshes', async () => {
    await populated(); fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'editor' } }); submit();
    await screen.findByText('Invitation sent'); expect(calls[1]).toEqual({ operation: 'create', tripId: 'demo', email: 'new@example.test', role: 'editor' });
    expect(calls[2].operation).toBe('list_access'); expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Role') as HTMLSelectElement).value).toBe('viewer');
  });
  it('prevents duplicate submissions while pending', async () => {
    await populated(); let finish!: () => void; holdMutation = new Promise(resolve => { finish = resolve; });
    submit(); fireEvent.submit(screen.getByLabelText('Email').closest('form')!);
    expect(calls.filter(c => c.operation === 'create')).toHaveLength(1); expect(screen.getByText('Working…')).toBeTruthy(); await act(async () => finish());
  });
  it.each(['invalid_request', 'invitation_pending', 'not_authorized', 'unavailable', 'unexpected_private_message'])('handles %s safely without clearing the input', async code => {
    await populated(); status = 400; result = { code }; submit(); await screen.findByRole('alert');
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('new@example.test'); expect(screen.queryByText(code)).toBeNull();
  });
  it.each(['failed', 'unknown', 'not_sent'])('does not claim sent for delivery %s and refreshes persisted state', async delivery => {
    await populated(); result = { delivery }; submit(); await screen.findByRole('alert'); expect(screen.queryByText('Invitation sent')).toBeNull(); expect(calls.at(-1)?.operation).toBe('list_access');
  });
  it('requires removal confirmation, preserves Crew semantics, refreshes, and focuses a surviving control', async () => {
    await populated(); fireEvent.click(screen.getByRole('button', { name: /Remove access/ }));
    expect(screen.getByRole('dialog', { name: 'Remove access?' })).toBeTruthy(); expect(screen.getByText(/Their Crew entry and trip responsibilities will remain/)).toBeTruthy();
    expect(calls).toHaveLength(1); fireEvent.click(screen.getByRole('button', { name: 'Remove access' }));
    await screen.findByText('Access removed'); expect(screen.queryByText('Unknown member')).toBeNull(); expect(document.activeElement).toBe(screen.getByLabelText('Email'));
    expect(calls.map(c => c.operation)).toEqual(['list_access', 'remove_access', 'list_access']);
  });
  it('keeps the member after a failed removal; cancel returns action focus', async () => {
    await populated(); fireEvent.click(screen.getByRole('button', { name: /Remove access/ })); status = 403; result = { code: 'not_authorized' };
    fireEvent.click(screen.getByRole('button', { name: 'Remove access' })); await screen.findByRole('alert'); fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('Unknown member')).toBeTruthy(); expect(document.activeElement).toBe(screen.getByRole('button', { name: /Remove access/ }));
  });
  it('resends and refreshes', async () => { await populated(); fireEvent.click(screen.getByRole('button', { name: /Resend/ })); await screen.findByText('Invitation resent'); expect(calls.map(c => c.operation)).toEqual(['list_access', 'resend', 'list_access']); });
  it('confirms revoke, refreshes, and renders the quiet empty state', async () => {
    await populated(); fireEvent.click(screen.getByRole('button', { name: /Revoke/ })); expect(screen.getByRole('dialog', { name: 'Revoke invitation?' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Revoke' })); await screen.findByText('No pending invitations'); expect(calls.map(c => c.operation)).toEqual(['list_access', 'revoke', 'list_access']);
  });
  it('honors the actual resend Retry-After cooldown', async () => {
    await populated(); status = 429; result = { code: 'rate_limited' }; retry = '2';
    fireEvent.click(screen.getByRole('button', { name: /Resend/ })); await screen.findByText('Try again in 2 seconds.');
    expect((screen.getByRole('button', { name: /Resend/ }) as HTMLButtonElement).disabled).toBe(true);
    await waitFor(() => expect((screen.getByRole('button', { name: /Resend/ }) as HTMLButtonElement).disabled).toBe(false), { timeout: 3500 });
  });
  it('uses phone More and the same usable form/rows, returning focus to More', async () => {
    await open(true); await screen.findByText('Unknown member'); expect(document.querySelector('.trip-access-sheet--phone')).toBeTruthy();
    expect(screen.getByLabelText('Email')).toBeTruthy(); expect(screen.getByRole('button', { name: /Resend/ })).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close panel' })));
    fireEvent.keyDown(document, { key: 'Escape' }); expect(document.activeElement).toBe(screen.getByRole('button', { name: 'More trip actions' }));
  });
  it.each(['viewer', 'editor'])('phone More hides management when %s', async () => {
    mount(false, true); await act(async () => {}); fireEvent.click(screen.getByRole('button', { name: 'More trip actions' })); expect(screen.queryByRole('button', { name: 'Trip access' })).toBeNull();
  });
  it('parses delta and date Retry-After without inventing a fallback', () => {
    expect(retryDelay('42')).toBe(42); expect(retryDelay('invalid')).toBe(0); expect(retryDelay(null)).toBe(0);
    expect(retryDelay('Sun, 13 Sep 2026 12:00:02 GMT', Date.parse('2026-09-13T12:00:00Z'))).toBe(2);
  });
});
