'use client';

import Image from 'next/image';
import {
  Activity,
  AlertTriangle,
  Backpack,
  ChevronRight,
  ClipboardCheck,
  CloudSun,
  Compass,
  MapPinned,
  ShieldCheck,
  Trees,
} from 'lucide-react';
import { useState } from 'react';

import {
  READINESS_STATUS_LABELS,
  type ReadinessIssueSeverity,
  type ReadinessStatus,
} from '@/lib/readiness';

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

const mobileReadinessInputs = [
  { label: 'Plan', icon: MapPinned, kind: 'scored' },
  { label: 'Gear', icon: Backpack, kind: 'scored' },
  { label: 'Field Prep', icon: ClipboardCheck, kind: 'scored' },
  { label: 'Conditions', icon: CloudSun, kind: 'context' },
] as const;

const mobileAssessmentExample = {
  status: 'needs-attention',
  severity: 'blocker',
  blockerCount: 1,
  blockerCopy: 'Critical gear still needs to be acquired',
  nextAction: 'Review gear',
} as const satisfies {
  status: ReadinessStatus;
  severity: ReadinessIssueSeverity;
  blockerCount: number;
  blockerCopy: string;
  nextAction: string;
};

function MobileReadinessStory() {
  const statusLabel = READINESS_STATUS_LABELS[mobileAssessmentExample.status];

  return (
    <div className="signed-out-mobile-story">
      <section className="signed-out-mobile-inputs" aria-labelledby="signed-out-mobile-inputs-heading">
        <h2 id="signed-out-mobile-inputs-heading" className="sr-only">Readiness inputs</h2>
        <div className="signed-out-mobile-route" aria-hidden="true">
          <svg className="signed-out-mobile-route__trail" viewBox="0 0 400 100" preserveAspectRatio="none">
            <path d="M6 40 C52 33 96 33 142 37 S220 44 267 38 S343 34 394 39" />
          </svg>
        </div>
        <ol className="signed-out-mobile-input-list">
          {mobileReadinessInputs.map(({ label, icon: Icon, kind }) => (
            <li
              className="signed-out-mobile-input"
              data-input-kind={kind}
              data-marketing-type-role="ui-label"
              key={label}
            >
              <span className="signed-out-mobile-input__marker">
                <Icon size={21} strokeWidth={1.6} aria-hidden="true" />
              </span>
              <span>{label}</span>
              {kind === 'context' ? <small>Context</small> : null}
            </li>
          ))}
        </ol>
      </section>

      <section
        className="signed-out-mobile-assessment"
        aria-labelledby="signed-out-mobile-assessment-heading"
        data-readiness-status={mobileAssessmentExample.status}
        data-issue-severity={mobileAssessmentExample.severity}
      >
        <div className="signed-out-mobile-assessment__header">
          <div>
            <p>Example trip assessment</p>
            <h2 id="signed-out-mobile-assessment-heading">Readiness command</h2>
          </div>
          <Activity size={21} strokeWidth={1.75} aria-hidden="true" />
        </div>
        <div className="signed-out-mobile-assessment__state">
          <AlertTriangle size={25} strokeWidth={1.8} aria-hidden="true" />
          <p>{statusLabel}</p>
        </div>
        <div className="signed-out-mobile-assessment__blocker">
          <p>{mobileAssessmentExample.blockerCount} blocker</p>
          <span>{mobileAssessmentExample.blockerCopy}</span>
        </div>
        <div className="signed-out-mobile-assessment__action" aria-label={`Next action: ${mobileAssessmentExample.nextAction}`}>
          <span><small>Next action</small>{mobileAssessmentExample.nextAction}</span>
          <ChevronRight size={22} strokeWidth={1.7} aria-hidden="true" />
        </div>
      </section>

      <p className="signed-out-mobile-closing">Every trip signal, one field view</p>
    </div>
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
      <span className="signed-out-brand__name" data-marketing-type-role="editorial-brand">FIELD<br />PROTOCOL</span>
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
    <main
      className="signed-out-landing"
      data-signed-out-landing
      data-signed-out-type-system="editorial-operational-bridge"
    >
      <div className="signed-out-landing__topo" aria-hidden="true" />
      <div className="signed-out-landing__shell">
        <section className="signed-out-intro" aria-labelledby="signed-out-heading">
          <FieldProtocolMark />
          <div className="signed-out-intro__copy">
            <p className="signed-out-eyebrow" data-marketing-type-role="operational-display">
              <span className="signed-out-copy--desktop">Your outdoor command centre</span>
              <span className="signed-out-copy--mobile">Trip readiness, made clear</span>
            </p>
            <h1 id="signed-out-heading" data-marketing-type-role="editorial-hero">
              <span className="signed-out-copy--desktop"><span>Plan the trip.</span><span>Pack with confidence.</span><span>Get outside.</span></span>
              <span className="signed-out-copy--mobile" data-marketing-type-role="operational-hero"><span>Know what</span><span>needs attention.</span><span>Then head out.</span></span>
            </h1>
            <p className="signed-out-lede" data-marketing-type-role="ui-body">
              <span className="signed-out-copy--desktop">Organize your campsite, gear, crew, weather and daily plans in one shared camping workspace.</span>
              <span className="signed-out-copy--mobile">Plan the trip, identify critical gear, coordinate preparation, and see the next action before you leave.</span>
            </p>
            {error ? <p role="alert" className="signed-out-error">{error}</p> : null}
            <button type="button" className="signed-out-google" data-marketing-type-role="ui-control" onClick={() => void handleSignIn()} disabled={isStartingSignIn}>
              <Image src="/google-g-logo.png" alt="" width={18} height={18} aria-hidden="true" />
              <span>{isStartingSignIn ? 'Connecting…' : 'Continue with Google'}</span>
            </button>
            <p className="signed-out-reassurance" data-marketing-type-role="ui-supporting"><ShieldCheck size={17} /> Free to get started <span>·</span> No credit card required</p>
          </div>
        </section>

        <MobileReadinessStory />
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
