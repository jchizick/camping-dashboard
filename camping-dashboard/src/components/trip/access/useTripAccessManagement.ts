'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { TripAccessManagement } from '@/lib/invitations/contracts';

type Action = { operation: 'create'; email: string; role: 'viewer' | 'editor' }
  | { operation: 'resend' | 'revoke'; invitationId: string }
  | { operation: 'remove_access'; membershipId: string };

const messages: Record<string, string> = {
  invalid_request: 'Check the email and selected action, then try again.',
  invitation_pending: 'An invitation is already pending for this person. Review pending invitations.',
  not_authorized: 'Only a current trip Owner can manage access.',
  not_authenticated: 'Sign in again to manage trip access.',
  unavailable: 'This invitation or access is no longer available. Refresh the list.',
  delivery_unavailable: 'Trip access is currently unavailable.',
  rate_limited: 'Too many requests. Please try again shortly.',
};
export function retryDelay(value: string | null, now = Date.now()) {
  if (!value) return 0;
  const seconds = /^\d+$/.test(value) ? Number(value) : (Date.parse(value) - now) / 1000;
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 0;
}

/** The browser uses only the product API. Roles here gate presentation, never authorization. */
export function useTripAccessManagement(tripId: string, eligible: boolean) {
  const [availability, setAvailability] = useState<{ tripId: string; value: boolean } | null>(null);
  const available = availability?.tripId === tripId && availability.value;
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<TripAccessManagement | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const busyRef = useRef(false);
  const until = useRef(0);
  const read = useRef<AbortController | null>(null);
  const mutation = useRef<AbortController | null>(null);
  useEffect(() => () => { read.current?.abort(); mutation.current?.abort(); busyRef.current = false; }, [tripId, eligible]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(async () => {
      if (controller.signal.aborted) return;
      setAvailability(null); setOpen(false); setSnapshot(null); setBusy(false); setError(''); setNotice('');
      if (!eligible) return;
      try {
        const r = await fetch('/api/invitations', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
        const b = await r.json();
        if (!controller.signal.aborted) setAvailability({ tripId, value: r.ok && b.tripAccessAvailable === true });
      } catch { /* Availability fails closed; no management request follows. */ }
    });
    return () => controller.abort();
  }, [eligible, tripId]);

  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setInterval(() => setCooldown(Math.max(0, Math.ceil((until.current - Date.now()) / 1000))), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const refresh = useCallback(async () => {
    if (!eligible || !available) return;
    read.current?.abort();
    const controller = new AbortController(); read.current = controller;
    setLoading(true); setError('');
    try {
      const r = await fetch('/api/invitations', { method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operation: 'list_access', tripId }) });
      const b = await r.json();
      if (controller.signal.aborted) return;
      const next = r.ok && Array.isArray(b?.people) && Array.isArray(b?.pendingInvitations) ? b as TripAccessManagement : null;
      if (!next) { setSnapshot(null); setError(messages[b?.code] ?? 'Could not load trip access. Please try again.'); }
      else setSnapshot(next);
    } catch { if (!controller.signal.aborted) { setSnapshot(null); setError('Could not load trip access. Please try again.'); } }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, [eligible, available, tripId]);
  useEffect(() => {
    if (open) void refresh();
    return () => read.current?.abort();
  }, [open, refresh]);

  async function act(action: Action) {
    if (!eligible || !available || busyRef.current || until.current > Date.now()) return false;
    busyRef.current = true; setBusy(true); setError(''); setNotice('');
    const controller = new AbortController(); mutation.current = controller;
    try {
      const r = await fetch('/api/invitations', { method: 'POST', credentials: 'same-origin', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...action, tripId }) });
      const b = await r.json();
      if (controller.signal.aborted) return false;
      if (!r.ok) {
        const delay = retryDelay(r.headers.get('Retry-After'));
        if (r.status === 429 && delay) { until.current = Date.now() + delay * 1000; setCooldown(delay); }
        setError(messages[b?.code] ?? 'Could not complete this action. Please try again.'); return false;
      }
      // Sending can fail after the pending invitation has been persisted. Always refresh.
      await refresh();
      if (controller.signal.aborted) return false;
      if (action.operation === 'create' || action.operation === 'resend') {
        if (b.delivery !== 'sent') {
          setError(b.delivery === 'unknown' ? 'Sending could not be confirmed. Review pending invitations before trying again.'
            : 'The invitation was not sent. Review pending invitations and try Resend.'); return false;
        }
        setNotice(action.operation === 'create' ? 'Invitation sent' : 'Invitation resent');
      } else setNotice(action.operation === 'revoke' ? 'Invitation revoked' : 'Access removed');
      return true;
    } catch { if (!controller.signal.aborted) setError('Could not confirm this action. Refresh trip access before trying again.'); return false; }
    finally { if (mutation.current === controller) { busyRef.current = false; if (!controller.signal.aborted) setBusy(false); } }
  }
  return { available: eligible && available, open: eligible && available && open, show: () => setOpen(true), close: () => setOpen(false),
    snapshot, loading, busy, error, notice, cooldown, refresh, act };
}
