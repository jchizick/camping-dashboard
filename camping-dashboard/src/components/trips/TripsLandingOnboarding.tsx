import Link from 'next/link';
import { Compass, Plus } from 'lucide-react';
import { NEW_TRIP_HREF } from '@/lib/tripsLanding';

export function TripsWelcome({
  firstName,
  hasTrips,
}: {
  firstName: string;
  hasTrips: boolean;
}) {
  return (
    <header className="trips-welcome" data-trips-state={hasTrips ? 'populated' : 'empty'}>
      {hasTrips ? (
        <>
          <div className="trips-welcome__copy">
            <h1 data-mobile-type-role="page-title">Your Trips</h1>
            <p><strong>Welcome back, {firstName}.</strong> Pick up where you left off or start another trip.</p>
          </div>
          <Link href={NEW_TRIP_HREF} className="trips-primary-action"><Plus size={19} aria-hidden="true" /> Plan a New Trip</Link>
        </>
      ) : (
        <div className="trips-welcome__copy">
          <h1 data-mobile-type-role="page-title">Plan your first trip</h1>
          <p>You don’t have a trip yet. Create your first trip to start planning readiness.</p>
        </div>
      )}
    </header>
  );
}

export function EmptyTripsState() {
  return (
    <section className="trips-empty" aria-labelledby="trips-heading">
      <span className="trips-empty__icon" aria-hidden="true"><Compass size={34} /></span>
      <h2 id="trips-heading">No trips yet</h2>
      <p>Choose a place and dates to begin.</p>
      <Link href={NEW_TRIP_HREF} className="trips-primary-action"><Plus size={19} aria-hidden="true" /> Plan your first trip</Link>
    </section>
  );
}
