'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/authContext';
import { emailCodeSignInEnabled } from '@/lib/emailCode';
import './emailCodeDialog.css';

export function EmailCodeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, operation, emailChallenge, requestEmailCode, verifyEmailCode, changeEmail } = useAuth();
  const dialog = useRef<HTMLDialogElement>(null);
  const generation = useRef(0);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [now, setNow] = useState(0);
  const busy = Boolean(operation);
  const cooldown = emailChallenge ? Math.min(60, Math.max(0, Math.ceil((emailChallenge.sentAt + 60_000 - now) / 1000))) : 0;

  useEffect(() => {
    if (!open) return;
    const lifecycle = generation;
    const element = dialog.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    element?.showModal();
    element?.querySelector<HTMLInputElement>('input')?.focus();
    const tick = () => setNow(Date.now());
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => {
      lifecycle.current++;
      window.clearInterval(interval);
      element?.close();
      previousFocus?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (open && emailChallenge) dialog.current?.querySelector<HTMLInputElement>('input')?.focus();
  }, [open, emailChallenge]);

  async function submit(action: 'request' | 'verify') {
    const attempt = generation.current;
    setError('');
    try {
      if (action === 'request') await requestEmailCode(emailChallenge?.email ?? email);
      else await verifyEmailCode(emailChallenge!.email, code);
      if (attempt !== generation.current) return;
      setCode('');
      if (action === 'verify') onClose();
    } catch (failure) {
      if (attempt === generation.current) setError(failure instanceof Error ? failure.message : 'Please try again.');
    }
  }

  function close() {
    generation.current++;
    setCode(''); setEmail(''); setError('');
    onClose();
  }

  if (!emailCodeSignInEnabled()) return null;
  return <dialog ref={dialog} className="email-code-dialog" aria-labelledby="email-code-title"
    onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])'));
      const first = controls[0]; const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}
    onCancel={event => { event.preventDefault(); close(); }}>
    <button className="email-code-dialog__close" type="button" onClick={close} aria-label="Close email sign-in">×</button>
    <p className="email-code-dialog__brand">FIELD PROTOCOL</p>
    <h2 id="email-code-title">{emailChallenge ? 'Check your email' : 'Continue with email'}</h2>
    {user ? <p role="status">You’re signed in.</p> : <>
      <p>{emailChallenge ? 'If a code can be sent, it will arrive shortly. Enter the six-digit code below. It expires in 10 minutes.' : 'We’ll email you a one-time code. No password needed.'}</p>
      <form onSubmit={event => { event.preventDefault(); void submit(emailChallenge ? 'verify' : 'request'); }}>
        {emailChallenge ? <>
          <label htmlFor="email-sign-in-code">Six-digit code</label>
          <input id="email-sign-in-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}"
            required value={code} disabled={busy} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} />
        </> : <>
          <label htmlFor="email-sign-in-address">Email address</label>
          <input id="email-sign-in-address" type="email" autoComplete="email" required maxLength={254}
            value={email} disabled={busy} onChange={event => setEmail(event.target.value)} />
        </>}
        <button className="email-code-dialog__primary" disabled={busy} type="submit">
          {operation === 'verify' ? 'Verifying…' : operation === 'request' ? 'Requesting…' : emailChallenge ? 'Verify code' : 'Send code'}
        </button>
      </form>
      {emailChallenge && <div className="email-code-dialog__secondary">
        <button type="button" disabled={busy || cooldown > 0} onClick={() => void submit('request')}>{cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}</button>
        <button type="button" disabled={busy} onClick={() => { generation.current++; changeEmail(); setCode(''); setError(''); }}>Change email</button>
      </div>}
      {busy && <p role="status">An authentication action is in progress. Closing this dialog does not cancel it.</p>}
      {error && <p role="alert">{error}</p>}
    </>}
  </dialog>;
}
