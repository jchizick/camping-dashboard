import Image from 'next/image';
import './desktopSignedOutLanding.css';

type Props = {
  error: string | null;
  pending: boolean;
  onSignIn: () => Promise<void>;
};

export function DesktopSignedOutLanding({ error, pending, onSignIn }: Props) {
  return (
    <main data-desktop-signed-out>
      <div className="desktop-landing__topo" aria-hidden="true" />
      <header className="desktop-landing__brand" aria-label="Field Protocol">
        <Image src="/logo.svg" alt="" width={34} height={40} aria-hidden="true" />
        <span>FIELD PROTOCOL</span>
      </header>
      <section className="desktop-landing__hero" aria-labelledby="desktop-landing-heading">
        <p className="desktop-landing__eyebrow">YOUR OUTDOOR COMMAND CENTRE</p>
        <h1 id="desktop-landing-heading">Trip readiness, made clear.</h1>
        <p className="desktop-landing__copy">Plan, pack, and coordinate every trip in one workspace designed for clarity before you head out.</p>
        {error ? <p className="desktop-landing__error" role="alert">{error}</p> : null}
        <div className="desktop-landing__actions">
          <button type="button" onClick={() => void onSignIn()} disabled={pending}>
            <Image src="/google-g-logo.png" alt="" width={20} height={20} aria-hidden="true" />
            <span>{pending ? 'Connecting…' : 'Sign in with Google'}</span>
          </button>
        </div>
        <p className="desktop-landing__helper">Free to get started · No credit card required</p>
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
      </div>
    </main>
  );
}
