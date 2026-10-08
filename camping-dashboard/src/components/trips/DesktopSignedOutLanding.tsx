'use client';

import Image from 'next/image';
import { useRef, useState } from 'react';
import { DesktopLandingSections } from './DesktopLandingSections';
import './desktopSignedOutLanding.css';

type Props = {
  error: string | null;
  pending: boolean;
  onSignIn: () => Promise<void>;
  onEmail?: () => void;
};

type AuthLocation = 'hero' | 'readiness' | 'closing';

function GoogleSignIn({ location, error, pending, onSignIn, onEmail }: Props & { location: AuthLocation }) {
  return (
    <div className="desktop-landing__auth" data-desktop-auth-location={location}>
      {error ? <p className="desktop-landing__error" role="alert">{error}</p> : null}
      <div className="desktop-landing__actions">
        <button type="button" onClick={() => void onSignIn()} disabled={pending}>
          <Image src="/google-g-logo.png" alt="" width={20} height={20} aria-hidden="true" />
          <span>{pending ? 'Connecting…' : 'Sign in with Google'}</span>
        </button>
        {onEmail && <button type="button" className="email-code-entry" onClick={onEmail}>Continue with email</button>}
      </div>
      <p className="desktop-landing__helper">Free to get started · No credit card required</p>
    </div>
  );
}

export function DesktopSignedOutLanding({ error, pending, onSignIn, onEmail }: Props) {
  const [authLocation, setAuthLocation] = useState<AuthLocation>('hero');
  const signInInFlight = useRef(false);

  async function startSignIn(location: AuthLocation) {
    if (pending || signInInFlight.current) return;
    signInInFlight.current = true;
    setAuthLocation(location);
    try {
      await onSignIn();
    } finally {
      signInInFlight.current = false;
    }
  }

  function renderSignIn(location: AuthLocation) {
    return <GoogleSignIn onEmail={onEmail} location={location} error={authLocation === location ? error : null} pending={pending} onSignIn={() => startSignIn(location)} />;
  }

  return (
    <main data-desktop-signed-out>
      <div className="desktop-landing__topo" aria-hidden="true" />
      <header className="desktop-landing__header">
        <div className="desktop-landing__brand" aria-label="Field Protocol">
          <Image src="/logo.svg" alt="" width={34} height={40} aria-hidden="true" />
          <span>FIELD PROTOCOL</span>
        </div>
        <nav className="desktop-landing__nav" aria-label="Landing page">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <a href="#faq">FAQ</a>
          <button className="desktop-landing__nav-sign-in" type="button" disabled={pending} onClick={() => void startSignIn('hero')}>{pending ? 'Connecting…' : 'Sign in'}</button>
        </nav>
      </header>
      <section className="desktop-landing__hero" aria-labelledby="desktop-landing-heading">
        <p className="desktop-landing__eyebrow">YOUR OUTDOOR COMMAND CENTRE</p>
        <h1 id="desktop-landing-heading">Trip readiness, made clear.</h1>
        <p className="desktop-landing__copy">Plan, pack, and coordinate every trip in one workspace designed for clarity before you head out.</p>
        {renderSignIn('hero')}
      </section>
      <div className="desktop-landing__preview-frame">
        <div className="desktop-landing__preview-instrument" aria-hidden="true"><span>SYSTEM / TRIP READINESS</span></div>
        <div className="desktop-landing__preview" data-desktop-landing-preview>
          <Image
            src="/trips/desktop-workspace-preview.webp"
            alt="Field Protocol trip workspace showing readiness, route, schedule, conditions, trip essentials for gear, meals and crew, and trip access controls."
            width={2560}
            height={1551}
            unoptimized
            sizes="(min-width: 1304px) 1240px, (max-width: 1024px) calc(100vw - 48px), calc(100vw - 64px)"
            quality={92}
            loading="eager"
          />
        </div>
      </div>
      <DesktopLandingSections renderSignIn={renderSignIn} />
    </main>
  );
}
