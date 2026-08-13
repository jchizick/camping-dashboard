'use client';

import Image from 'next/image';
import {
  Backpack,
  Check,
  CloudSun,
  Compass,
  Flag,
  MapPinned,
  ShieldCheck,
  TentTree,
  Trees,
} from 'lucide-react';
import { useState, type CSSProperties } from 'react';

import { SignedOutProductPreview } from './SignedOutProductPreview';

type SignedOutLandingProps = {
  error: string | null;
  onSignIn: () => Promise<void>;
};

const capabilities = [
  { title: 'Trips', copy: 'Plan and organize every adventure.', icon: MapPinned },
  { title: 'Gear Closet', copy: 'Track and pack with confidence.', icon: Backpack },
  { title: 'Camper Guide', copy: 'Tips, checklists and know-how.', icon: Compass },
  { title: 'Field Resources', copy: 'Maps, weather and park information.', icon: Trees },
] as const;

const mobileJourneyStops = [
  { label: 'Plan', icon: MapPinned, x: 46, y: 90 },
  { label: 'Camp', icon: TentTree, x: 145, y: 52 },
  { label: 'Conditions', icon: CloudSun, x: 250, y: 92 },
  { label: 'Ready', icon: Flag, x: 354, y: 58 },
] as const;

const mobileReadinessItems = ['Campsite', 'Gear', 'Crew', 'Weather'] as const;

function MobileExpeditionJourney() {
  return (
    <section className="signed-out-mobile-journey" aria-label="Plan, pack and prepare">
      <div className="signed-out-mobile-route" aria-hidden="true">
        <svg className="signed-out-mobile-route__trail" viewBox="0 0 400 145" preserveAspectRatio="none">
          <path d="M9 112 C48 107 55 76 93 78 S132 118 170 91 S214 47 253 86 S300 116 329 80 S366 82 391 64" />
        </svg>
        {mobileJourneyStops.map(({ label, icon: Icon, x, y }) => (
          <div
            className="signed-out-mobile-route__stop"
            key={label}
            style={{ '--route-x': `${x / 4}%`, '--route-y': `${y}px` } as CSSProperties}
          >
            <span className="signed-out-mobile-route__marker"><Icon size={25} strokeWidth={1.65} /></span>
            <i />
          </div>
        ))}
      </div>
      <div className="signed-out-mobile-readiness">
        {mobileReadinessItems.map((label) => (
          <span className="signed-out-mobile-readiness__pill" key={label}>
            <Check size={14} strokeWidth={2.5} aria-hidden="true" />
            {label}
          </span>
        ))}
      </div>
    </section>
  );
}

function FieldProtocolMark() {
  return (
    <div className="signed-out-brand" aria-label="Field Protocol">
      <Image
        className="signed-out-brand__crest"
        src="/logo.svg"
        alt=""
        width={64}
        height={76}
        aria-hidden="true"
      />
      <span className="signed-out-brand__name">FIELD<br />PROTOCOL</span>
    </div>
  );
}

export function SignedOutLanding({ error, onSignIn }: SignedOutLandingProps) {
  const [isStartingSignIn, setIsStartingSignIn] = useState(false);

  async function handleSignIn() {
    if (isStartingSignIn) return;
    setIsStartingSignIn(true);
    try {
      await onSignIn();
    } finally {
      setIsStartingSignIn(false);
    }
  }

  return (
    <main className="signed-out-landing" data-signed-out-landing>
      <div className="signed-out-landing__topo" aria-hidden="true" />
      <div className="signed-out-landing__shell">
        <section className="signed-out-intro" aria-labelledby="signed-out-heading">
          <FieldProtocolMark />
          <div className="signed-out-intro__copy">
            <p className="signed-out-eyebrow">Your outdoor command centre</p>
            <h1 id="signed-out-heading"><span>Plan the trip.</span><span>Pack with confidence.</span><span>Get outside.</span></h1>
            <p className="signed-out-lede">Organize your campsite, gear, crew, weather and daily plans in one shared camping workspace.</p>
            {error ? <p role="alert" className="signed-out-error">{error}</p> : null}
            <button type="button" className="signed-out-google" onClick={() => void handleSignIn()} disabled={isStartingSignIn}>
              <Image src="/google-g-logo.png" alt="" width={18} height={18} aria-hidden="true" />
              <span>{isStartingSignIn ? 'Connecting…' : 'Continue with Google'}</span>
            </button>
            <p className="signed-out-reassurance"><ShieldCheck size={17} /> Free to get started <span>·</span> No credit card required</p>
          </div>
        </section>

        <MobileExpeditionJourney />
        <SignedOutProductPreview />

        <section className="signed-out-capabilities" aria-label="Field Protocol capabilities">
          {capabilities.map(({ title, copy, icon: Icon }) => (
            <article className="signed-out-capability" key={title}>
              <Icon size={50} strokeWidth={1.35} aria-hidden="true" />
              <div><h2>{title}</h2><p>{copy}</p></div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
