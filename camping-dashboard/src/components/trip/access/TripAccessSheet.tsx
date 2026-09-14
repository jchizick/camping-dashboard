'use client';
import { useEffect, useId, useRef, useState } from 'react';
import CrudSheet from '@/components/ui/CrudSheet';
import { usePhoneLayout } from '../PhoneLayoutProvider';
import type { useTripAccessManagement } from './useTripAccessManagement';

type Confirmation = { operation: 'remove_access'; membershipId: string } | { operation: 'revoke'; invitationId: string };
export function formatAccessExpiry(value: string, locale?: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}
export default function TripAccessSheet({ access }: { access: ReturnType<typeof useTripAccessManagement> }) {
  const phone = usePhoneLayout();
  const id = useId();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'viewer' | 'editor'>('viewer');
  const [confirm, setConfirm] = useState<Confirmation | null>(null);
  const confirmFocus = useRef<HTMLButtonElement>(null);
  const previousAction = useRef<string | null>(null);
  useEffect(() => {
    if (confirm) confirmFocus.current?.focus();
    else if (previousAction.current) {
      const action = Array.from(document.querySelectorAll<HTMLElement>('[data-access-action]'))
        .find(element => element.dataset.accessAction === previousAction.current);
      (action ?? document.querySelector<HTMLElement>('.trip-access-sheet input'))?.focus();
    }
  }, [confirm]);
  function ask(next: Confirmation) { previousAction.current = next.operation === 'revoke' ? next.invitationId : next.membershipId; setConfirm(next); }
  const removing = confirm?.operation === 'remove_access';
  const disabled = access.busy || access.cooldown > 0;
  const feedback = <>
    {access.cooldown > 0 ? <p role="status" className="trip-access-feedback">Try again in {access.cooldown} seconds.</p>
      : access.error && <p role="alert" className="trip-access-feedback">{access.error}</p>}
    {access.notice && <p role="status" className="trip-access-feedback">{access.notice}</p>}
  </>;
  return <CrudSheet isOpen title={confirm ? (removing ? 'Remove access?' : 'Revoke invitation?') : 'Trip access'}
    onClose={() => confirm ? setConfirm(null) : access.close()} surface="workspace"
    panelClassName={`trip-access-sheet${phone ? ' trip-access-sheet--phone' : ''}`}>
    {confirm ? <div className="trip-access-confirm">
      <p>{removing ? 'This person will no longer be able to open this trip. Their Crew entry and trip responsibilities will remain.' : 'This invitation will no longer be usable.'}</p>
      {feedback}
      <div className="trip-access-actions">
        <button ref={confirmFocus} type="button" onClick={() => setConfirm(null)}>Cancel</button>
        <button type="button" className="trip-access-primary trip-access-destructive" disabled={disabled} onClick={async () => { if (await access.act(confirm)) setConfirm(null); }}>
          {access.busy ? 'Working…' : removing ? 'Remove access' : 'Revoke'}
        </button>
      </div>
    </div> : <div className="trip-access-content" aria-busy={access.busy}>
      <p className="trip-access-support">Invite people to view or help edit this trip.</p>
      <form className="trip-access-form" onSubmit={async e => { e.preventDefault(); if (await access.act({ operation: 'create', email: email.trim(), role })) { setEmail(''); setRole('viewer'); } }}>
        <label htmlFor={id + '-email'}>Email</label>
        <input id={id + '-email'} name="email" type="email" autoComplete="email" maxLength={254} required value={email} onChange={e => setEmail(e.target.value)} disabled={access.busy} />
        <label htmlFor={id + '-role'}>Role</label>
        <select id={id + '-role'} value={role} onChange={e => setRole(e.target.value as 'viewer' | 'editor')} disabled={access.busy} aria-describedby={id + '-role-description'}>
          <option value="viewer">Viewer</option><option value="editor">Editor</option>
        </select>
        <p id={id + '-role-description'} className="trip-access-muted">{role === 'viewer' ? 'Can view this trip' : 'Can update trip planning'}</p>
        <button type="submit" className="trip-access-primary" disabled={disabled}>{access.busy ? 'Working…' : 'Send invite'}</button>
      </form>
      {feedback}
      {access.loading && <p role="status">Loading trip access…</p>}
      {!access.loading && !access.snapshot && <button type="button" onClick={() => void access.refresh()}>Retry loading access</button>}
      {access.snapshot && <>
        <section aria-labelledby={id + '-people'}><h3 id={id + '-people'}>People with access</h3>
          <ul>{access.snapshot.people.map(person => <li key={person.membershipId}>
            <div className="trip-access-person"><span className="trip-access-email">{person.email ?? 'Unknown member'}</span>
              <span className="trip-access-muted">{person.role === 'owner' ? 'Owner' : person.role === 'editor' ? 'Editor' : 'Viewer'}{person.isCurrentUser ? ' · You' : ''}</span></div>
            {person.role !== 'owner' && <button type="button" className="trip-access-destructive" data-access-action={person.membershipId} disabled={disabled} onClick={() => ask({ operation: 'remove_access', membershipId: person.membershipId })}>Remove access<span className="sr-only"> for {person.email ?? 'Unknown member'}</span></button>}
          </li>)}</ul>
        </section>
        <section aria-labelledby={id + '-pending'}><h3 id={id + '-pending'}>Pending invitations</h3>
          {access.snapshot.pendingInvitations.length === 0 ? <p className="trip-access-muted">No pending invitations</p> : <ul>{access.snapshot.pendingInvitations.map(invitation => <li key={invitation.invitationId}>
            <div className="trip-access-person"><span className="trip-access-email">{invitation.email}</span><span className="trip-access-muted">{invitation.role === 'viewer' ? 'Viewer' : 'Editor'} · Pending{formatAccessExpiry(invitation.expiresAt) && <> · <time dateTime={invitation.expiresAt}>Expires {formatAccessExpiry(invitation.expiresAt)}</time></>}</span></div>
            <div className="trip-access-actions"><button type="button" disabled={disabled} onClick={() => void access.act({ operation: 'resend', invitationId: invitation.invitationId })}>Resend<span className="sr-only"> invitation for {invitation.email}</span></button>
              <button type="button" className="trip-access-destructive" data-access-action={invitation.invitationId} disabled={disabled} onClick={() => ask({ operation: 'revoke', invitationId: invitation.invitationId })}>Revoke<span className="sr-only"> invitation for {invitation.email}</span></button></div>
          </li>)}</ul>}
        </section>
      </>}
    </div>}
  </CrudSheet>;
}
