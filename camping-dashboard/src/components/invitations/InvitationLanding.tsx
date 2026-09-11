'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import type { InvitationView } from '@/lib/invitations/contracts';
import './invitationLanding.css';

export default function InvitationLanding() {
  const {token} = useParams<{token:string}>();
  const router = useRouter();
  const {signIn,switchInvitationAccount} = useAuth();
  const [view,setView] = useState<InvitationView | null>(null);
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const pending = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/invitations',{method:'POST',credentials:'same-origin',cache:'no-store',
      headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'inspect',token}),signal:controller.signal})
      .then(async response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(result => setView(result))
      .catch(() => { if (!controller.signal.aborted) setError('Invitations are currently unavailable. Please try again when online.'); });
    return () => controller.abort();
  },[token]);

  async function act(action:'accept'|'signin'|'switch') {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try {
      if (action === 'signin') { await signIn(); return; }
      if (action === 'switch') { await switchInvitationAccount(`/invite/${token}`); return; }
      const response = await fetch('/api/invitations',{method:'POST',credentials:'same-origin',cache:'no-store',
        headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'accept',token})});
      if (response.status === 401) { setView({outcome:'signed_out'}); return; }
      if (!response.ok) throw new Error();
      const result: InvitationView = await response.json();
      setView(result);
      if (['accepted','already_accepted','already_member'].includes(result.outcome) && result.trip_id) {
        router.replace(`/trips/${encodeURIComponent(result.trip_id)}`);
      }
    } catch { setError('This action could not be completed. Please try again.'); }
    finally { pending.current = false; setBusy(false); }
  }

  const hasAccess = view && ['already_member','already_accepted','accepted'].includes(view.outcome) && view.trip_id;
  return <main className="invitation-landing">
    <p>FIELD PROTOCOL</p><h1>Trip invitation</h1>
    {!view && !error && <p role="status">Checking invitation…</p>}
    {view?.outcome === 'signed_out' && <><p>Sign in with the account that received this invitation. Nothing is accepted until you confirm.</p>
      <button disabled={busy} onClick={() => void act('signin')}>Sign in with Google</button></>}
    {view?.outcome === 'pending' && <><h2>{view.tripName}</h2><p>You’re invited as a {view.role}.</p>
      {view.expiresAt && <p>Expires {new Date(view.expiresAt).toLocaleString()}</p>}
      <button disabled={busy} onClick={() => void act('accept')}>{busy ? 'Accepting…' : 'Accept invitation'}</button></>}
    {view?.outcome === 'identity_mismatch' && <><p>This invitation requires a different verified account{view.maskedEmail ? ` (${view.maskedEmail})` : ''}.</p>
      <button disabled={busy} onClick={() => void act('switch')}>Switch account</button></>}
    {view?.outcome === 'expired' && <p>This invitation has expired. Ask the inviter for a new one.</p>}
    {view?.outcome === 'revoked' && <p>This invitation was revoked and is no longer available.</p>}
    {view?.outcome === 'unavailable' && <p>This invitation is invalid or no longer available.</p>}
    {hasAccess && <><p>You already have access to this trip.</p><button onClick={() => router.replace(`/trips/${encodeURIComponent(view.trip_id!)}`)}>Open trip</button></>}
    {view && ['already_accepted','accepted'].includes(view.outcome) && !hasAccess && <p>This invitation has already been used. Ask the owner for a new invitation if you need access again.</p>}
    {error && <p role="alert">{error}</p>}
  </main>;
}
