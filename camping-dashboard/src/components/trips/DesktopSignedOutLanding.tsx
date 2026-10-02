'use client';

import Image from 'next/image';
import { Backpack, ChevronDown, Ellipsis, UserRound, Users, Utensils } from 'lucide-react';
import { useRef, useState } from 'react';
import { DesktopLandingSections } from './DesktopLandingSections';
import './desktopSignedOutLanding.css';

type Props = {
  error: string | null;
  pending: boolean;
  onSignIn: () => Promise<void>;
};

type AuthLocation = 'hero' | 'readiness' | 'closing';

function GoogleSignIn({ location, error, pending, onSignIn }: Props & { location: AuthLocation }) {
  return (
    <div className="desktop-landing__auth" data-desktop-auth-location={location}>
      {error ? <p className="desktop-landing__error" role="alert">{error}</p> : null}
      <div className="desktop-landing__actions">
        <button type="button" onClick={() => void onSignIn()} disabled={pending}>
          <Image src="/google-g-logo.png" alt="" width={20} height={20} aria-hidden="true" />
          <span>{pending ? 'Connecting…' : 'Sign in with Google'}</span>
        </button>
      </div>
      <p className="desktop-landing__helper">Free to get started · No credit card required</p>
    </div>
  );
}

export function DesktopSignedOutLanding({ error, pending, onSignIn }: Props) {
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
    return <GoogleSignIn location={location} error={authLocation === location ? error : null} pending={pending} onSignIn={() => startSignIn(location)} />;
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
      <div className="desktop-landing__preview" data-desktop-landing-preview>
        <Image
          src="/trips/desktop-workspace-preview.webp"
          alt="Field Protocol trip workspace showing readiness, campsite setup, schedule, conditions, and section navigation."
          width={2560}
          height={1600}
          sizes="(min-width: 1304px) 1240px, (max-width: 1024px) calc(100vw - 48px), calc(100vw - 64px)"
          quality={92}
          loading="eager"
        />
        <div className="desktop-landing__preview-bottom">
          <div
            className="desktop-landing__sidebar-footer"
            aria-hidden="true"
            data-desktop-preview-sidebar-footer
          >
            <div className="desktop-landing__sidebar-extras">
              <Ellipsis size={16} strokeWidth={1.6} />
              <span>Trip Extras</span>
            </div>
            <div className="desktop-landing__sidebar-account">
              <UserRound size={16} strokeWidth={1.6} />
              <span>Demo camper</span>
              <ChevronDown size={12} strokeWidth={1.6} />
            </div>
          </div>
          <section
            className="desktop-landing__essentials"
            aria-label="Example trip essentials"
            data-desktop-preview-essentials
            data-desktop-product-example
          >
            <h2>Trip essentials</h2>
            <dl>
              <div>
                <dt><Backpack size={16} strokeWidth={1.6} aria-hidden="true" />Gear</dt>
                <dd>Critical gear packed.</dd>
              </div>
              <div>
                <dt><Utensils size={16} strokeWidth={1.6} aria-hidden="true" />Meals</dt>
                <dd>Meals planned for each day.</dd>
              </div>
              <div>
                <dt><Users size={16} strokeWidth={1.6} aria-hidden="true" />Crew</dt>
                <dd>Gear and meal prep assigned.</dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
      <DesktopLandingSections renderSignIn={renderSignIn} />
    </main>
  );
}
