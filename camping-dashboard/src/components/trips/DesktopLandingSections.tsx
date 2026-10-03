import Image from 'next/image';
import type { ReactNode } from 'react';
import {
  AlertTriangle,
  Backpack,
  CalendarDays,
  Check,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  ClipboardCheck,
  CloudSun,
  Droplets,
  Flame,
  List,
  MapPin,
  Tent,
  Users,
  Utensils,
} from 'lucide-react';
import './desktopLandingSections.css';

type DesktopLandingSectionsProps = {
  renderSignIn: (location: 'readiness' | 'closing') => ReactNode;
};

const faqItems = [
  {
    question: 'How do I get started?',
    answer: 'Sign in with Google and create your trip. Add your plans, gear, and crew, then review what needs attention. If you already have trips, sign-in opens your trip or lets you choose one.',
  },
  {
    question: 'Does everyone on the trip need an account?',
    answer: 'No. You can add your crew and assign gear or meal prep as you plan. Crew members who want to open the shared trip sign in with the Google account that received their invitation and accept it.',
  },
  {
    question: 'What does the readiness status mean?',
    answer: 'It reflects critical gear, meal planning, and preparation checks, and highlights the next thing to review.',
  },
  {
    question: 'Can I use it without a signal?',
    answer: 'Open your trip online on the same device before you leave. Your most recent trip can then be viewed offline in read-only mode. Field Log needs a connection. Offline access expires after 30 days without online verification.',
  },
  {
    question: 'Can I get started for free?',
    answer: 'Yes. You can get started without a credit card.',
  },
] as const;

function PlanExample() {
  return (
    <div className="desktop-marketing__example desktop-marketing__plan-example" data-desktop-product-example>
      <h3>Day 1</h3>
      <ol className="desktop-marketing__schedule">
        <li><time>09:00</time><span className="desktop-marketing__schedule-marker" aria-hidden="true" /><span>Meet at the trailhead</span></li>
        <li><time>11:30</time><span className="desktop-marketing__schedule-marker" aria-hidden="true" /><span>Set up camp</span></li>
        <li><time>18:00</time><span className="desktop-marketing__schedule-marker" aria-hidden="true" /><span>Dinner · Trail pasta</span></li>
      </ol>
    </div>
  );
}

function GearExample() {
  return (
    <div className="desktop-marketing__example" data-desktop-product-example>
      <h3>Packing list</h3>
      <ul className="desktop-marketing__example-rows">
        <li>
          <Tent size={23} strokeWidth={1.6} aria-hidden="true" />
          <span>Tent</span>
          <span className="desktop-marketing__status desktop-marketing__status--ready"><CircleCheck size={17} strokeWidth={1.6} aria-hidden="true" />Packed</span>
        </li>
        <li>
          <Flame size={23} strokeWidth={1.6} aria-hidden="true" />
          <span>Camp stove</span>
          <span className="desktop-marketing__status desktop-marketing__status--neutral"><CircleAlert size={17} strokeWidth={1.6} aria-hidden="true" />Not packed</span>
        </li>
        <li>
          <Droplets size={23} strokeWidth={1.6} aria-hidden="true" />
          <span>Water filter</span>
          <span className="desktop-marketing__status desktop-marketing__status--attention"><CircleAlert size={17} strokeWidth={1.6} aria-hidden="true" />Still needed</span>
        </li>
      </ul>
    </div>
  );
}

function CrewExample() {
  return (
    <div className="desktop-marketing__example" data-desktop-product-example>
      <h3>Crew</h3>
      <ul className="desktop-marketing__example-rows desktop-marketing__crew-rows">
        <li><span className="desktop-marketing__avatar desktop-marketing__avatar--sage" aria-hidden="true">S</span><span>Sam</span><span className="desktop-marketing__responsibility">Tent</span></li>
        <li><span className="desktop-marketing__avatar desktop-marketing__avatar--blue" aria-hidden="true">A</span><span>Alex</span><span className="desktop-marketing__responsibility">Camp stove</span></li>
        <li><span className="desktop-marketing__avatar desktop-marketing__avatar--lilac" aria-hidden="true">C</span><span>Casey</span><span className="desktop-marketing__responsibility">Meal prep</span></li>
      </ul>
    </div>
  );
}

function ConditionsExample() {
  return (
    <div className="desktop-marketing__example desktop-marketing__conditions-example" data-desktop-product-example>
      <h3>Conditions</h3>
      <div className="desktop-marketing__weather">
        <CloudSun size={48} strokeWidth={1.6} aria-hidden="true" />
        <div><p>18°C · Mainly clear</p><span>Northwoods Park</span></div>
      </div>
      <div className="desktop-marketing__preparation">
        <ClipboardCheck size={26} strokeWidth={1.6} aria-hidden="true" />
        <div>
          <p>Field preparation <span>·</span> 4 of 6 checks complete</p>
          <div className="desktop-marketing__preparation-progress" aria-hidden="true"><span /></div>
        </div>
        <span className="desktop-marketing__preparation-count" aria-hidden="true">4/6</span>
      </div>
    </div>
  );
}

function FeatureGrid() {
  return (
    <section id="features" className="desktop-marketing__section desktop-marketing__features" aria-labelledby="desktop-marketing-features-heading">
      <div className="desktop-marketing__section-heading">
        <h2 id="desktop-marketing-features-heading">Your plans. Your gear. Your crew. In one place.</h2>
        <p>Keep the daily plan, packing list, crew responsibilities, and field preparation together.</p>
      </div>
      <figure className="desktop-marketing__feature-figure">
        <div className="desktop-marketing__feature-grid">
          <article className="desktop-marketing__feature-card">
            <PlanExample />
            <div className="desktop-marketing__feature-copy">
              <CalendarDays size={27} strokeWidth={1.6} aria-hidden="true" />
              <div><h3>Keep the plan handy.</h3><p>Organize trip dates, campsite details, daily schedules, and meals in one place.</p></div>
            </div>
          </article>
          <article className="desktop-marketing__feature-card">
            <GearExample />
            <div className="desktop-marketing__feature-copy">
              <Backpack size={27} strokeWidth={1.6} aria-hidden="true" />
              <div><h3>Pack with confidence.</h3><p>Track critical gear, see what is acquired, and mark what is packed.</p></div>
            </div>
          </article>
          <article className="desktop-marketing__feature-card">
            <CrewExample />
            <div className="desktop-marketing__feature-copy">
              <Users size={27} strokeWidth={1.6} aria-hidden="true" />
              <div><h3>Share the load.</h3><p>Give gear and meal prep a clear owner, so everyone knows what they are responsible for.</p></div>
            </div>
          </article>
          <article className="desktop-marketing__feature-card">
            <ConditionsExample />
            <div className="desktop-marketing__feature-copy">
              <CloudSun size={27} strokeWidth={1.6} aria-hidden="true" />
              <div><h3>Keep the context close.</h3><p>View weather, keep campsite information handy, and work through preparation checks.</p></div>
            </div>
          </article>
        </div>
        <figcaption className="desktop-marketing__example-caption">Example trip details</figcaption>
      </figure>
    </section>
  );
}

function ReadinessExample() {
  return (
    <div className="desktop-marketing__readiness-example" aria-label="Example readiness check" data-desktop-product-example>
      <p className="desktop-marketing__readiness-label">Example readiness check</p>
      <div className="desktop-marketing__readiness-state">
        <h3>Needs Attention</h3>
        <span><AlertTriangle size={19} strokeWidth={1.6} aria-hidden="true" />1 blocker</span>
      </div>
      <dl className="desktop-marketing__readiness-rows">
        <div>
          <dt><span className="desktop-marketing__readiness-icon"><Backpack size={27} strokeWidth={1.6} aria-hidden="true" /></span>Water filter</dt>
          <dd><CircleAlert size={20} strokeWidth={1.6} aria-hidden="true" />Still needed</dd>
        </div>
        <div>
          <dt><span className="desktop-marketing__readiness-icon"><ClipboardCheck size={27} strokeWidth={1.6} aria-hidden="true" /></span>Manual preparation</dt>
          <dd><CircleAlert size={20} strokeWidth={1.6} aria-hidden="true" />4 of 6 complete</dd>
        </div>
      </dl>
      <div className="desktop-marketing__next-action"><p>Next action</p><strong>Review gear</strong></div>
    </div>
  );
}

export function DesktopLandingSections({ renderSignIn }: DesktopLandingSectionsProps) {
  return (
    <div className="desktop-marketing__sections">
      <FeatureGrid />
      <section className="desktop-marketing__section desktop-marketing__readiness" aria-labelledby="desktop-marketing-readiness-heading">
        <div className="desktop-marketing__readiness-copy">
          <h2 id="desktop-marketing-readiness-heading">Know what still needs doing.</h2>
          <p>Field Protocol brings critical gear, meal plans, and preparation checks into one readiness view, then points you to the next thing to review.</p>
          <ul className="desktop-marketing__readiness-signals">
            <li><AlertTriangle size={25} strokeWidth={1.6} aria-hidden="true" /><span>Missing critical gear</span></li>
            <li><Utensils size={25} strokeWidth={1.6} aria-hidden="true" /><span>Unplanned meals</span></li>
            <li><ClipboardCheck size={25} strokeWidth={1.6} aria-hidden="true" /><span>Incomplete preparation checks</span></li>
          </ul>
          <div className="desktop-marketing__cta">{renderSignIn('readiness')}</div>
        </div>
        <ReadinessExample />
      </section>
      <section id="how-it-works" className="desktop-marketing__section desktop-marketing__setup" aria-labelledby="desktop-marketing-setup-heading">
        <div className="desktop-marketing__section-heading"><h2 id="desktop-marketing-setup-heading">Start with the trip you already have in mind.</h2></div>
        <ol className="desktop-marketing__steps">
          <li>
            <div className="desktop-marketing__step-markers"><span aria-hidden="true">1</span><MapPin size={29} strokeWidth={1.6} aria-hidden="true" /></div>
            <div><h3>Create your trip</h3><p>Choose your destination and dates.</p></div>
          </li>
          <li>
            <div className="desktop-marketing__step-markers"><span aria-hidden="true">2</span><List size={29} strokeWidth={1.6} aria-hidden="true" /></div>
            <div><h3>Add plans, gear, and crew</h3><p>Build the schedule, organize the packing, and invite your crew.</p></div>
          </li>
          <li>
            <div className="desktop-marketing__step-markers"><span aria-hidden="true">3</span><Check size={29} strokeWidth={1.6} aria-hidden="true" /></div>
            <div><h3>Review what needs attention</h3><p>Check readiness and work through the next actions.</p></div>
          </li>
        </ol>
      </section>
      <section id="faq" className="desktop-marketing__section desktop-marketing__faq" aria-labelledby="desktop-marketing-faq-heading">
        <div className="desktop-marketing__faq-heading"><p className="desktop-marketing__eyebrow">FAQ</p><h2 id="desktop-marketing-faq-heading">Before you get started.</h2><p>Answers to common questions about Field Protocol.</p></div>
        <div className="desktop-marketing__faq-list">
          {faqItems.map(({ question, answer }, index) => (
            <details className="desktop-marketing__faq-item" open={index === 0} key={question}>
              <summary>{question}<ChevronDown size={21} strokeWidth={1.6} aria-hidden="true" /></summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>
      <section className="desktop-marketing__section desktop-marketing__closing" aria-labelledby="desktop-marketing-closing-heading">
        <h2 id="desktop-marketing-closing-heading">Get your next trip ready.</h2>
        <p>Bring your plans, packing, and people together.<br />See what still needs attention before you head out.</p>
        <div className="desktop-marketing__cta">{renderSignIn('closing')}</div>
      </section>
      <footer className="desktop-marketing__footer">
        <div className="desktop-marketing__footer-brand">
          <Image src="/logo.svg" alt="" width={40} height={48} aria-hidden="true" />
          <div><p>FIELD PROTOCOL</p><span>A shared workspace for camping trips.</span></div>
        </div>
        <nav aria-label="Footer"><a href="#features">Features</a><a href="#how-it-works">How it works</a><a href="#faq">FAQ</a></nav>
      </footer>
    </div>
  );
}
