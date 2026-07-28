import GuardedTripLink from '@/components/trip/GuardedTripLink';
import type {
  Alert,
  CrewMember,
  GearItem,
  Meal,
  OfflineStatus,
  ParkIntel,
  PrepFeedItem,
  TimelineEvent,
} from '@/types';
import type { HomeScheduleSummary } from './homeSelectors';
import {
  Backpack,
  BookOpenText,
  CalendarDays,
  ChevronRight,
  Compass,
  Users,
} from 'lucide-react';

interface TripSectionLinksProps {
  tripId: string;
  tripDays: number;
  timeline: TimelineEvent[];
  meals: Meal[];
  gear: GearItem[];
  crew: CrewMember[];
  alerts: Alert[];
  offlineStatus: OfflineStatus | null;
  parkIntel: ParkIntel | null;
  prepFeed: PrepFeedItem[];
  schedule: HomeScheduleSummary;
  showMeals: boolean;
  showCrew: boolean;
  showOffline: boolean;
  showAstro: boolean;
  hasAstro: boolean;
}

function SummaryLink({
  href,
  label,
  icon: Icon,
  children,
}: {
  href: string;
  label: string;
  icon: typeof CalendarDays;
  children: React.ReactNode;
}) {
  return (
    <GuardedTripLink
      href={href}
      aria-label={`Open ${label}`}
      className="group flex min-h-36 flex-col rounded-2xl border border-border-subtle bg-card-bg p-4 transition-colors hover:border-accent-yellow/35 hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
          <Icon size={16} className="text-accent-yellow" aria-hidden="true" />
          {label}
        </span>
        <ChevronRight
          size={16}
          className="text-text-muted transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </div>
      <div className="mt-4 flex flex-1 flex-col justify-end">{children}</div>
    </GuardedTripLink>
  );
}

function latestPrepItem(items: PrepFeedItem[]): PrepFeedItem | null {
  let latest: PrepFeedItem | null = null;
  for (const item of items) {
    if (!latest || Date.parse(item.created_at) > Date.parse(latest.created_at)) {
      latest = item;
    }
  }
  return latest;
}

export default function TripSectionLinks({
  tripId,
  tripDays,
  timeline,
  meals,
  gear,
  crew,
  alerts,
  offlineStatus,
  parkIntel,
  prepFeed,
  schedule,
  showMeals,
  showCrew,
  showOffline,
  showAstro,
  hasAstro,
}: TripSectionLinksProps) {
  const base = `/trips/${encodeURIComponent(tripId)}`;
  const packedCount = gear.filter((item) => item.packed).length;
  const acquiredCount = gear.filter((item) => item.acquired).length;
  const criticalUnresolved = gear.filter(
    (item) => item.priority === 'critical' && (!item.acquired || !item.packed)
  ).length;
  const assignedLoad = crew.reduce(
    (total, member) => total + (member.load_weight_kg ?? 0),
    0
  );
  const latestPrep = latestPrepItem(prepFeed);

  return (
    <section aria-labelledby="trip-workspaces-heading" className="space-y-4">
      <div>
        <h2 id="trip-workspaces-heading" className="text-xl font-bold text-text-main">
          Trip workspaces
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Continue planning in a dedicated section.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryLink href={`${base}/plan`} label="Plan" icon={CalendarDays}>
          <p className="text-lg font-semibold text-text-main">
            {timeline.length} event{timeline.length === 1 ? '' : 's'}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            {tripDays} trip day{tripDays === 1 ? '' : 's'}
            {showMeals ? ` · ${meals.length} meals` : ''}
          </p>
          {schedule.events[0] ? (
            <p className="mt-2 truncate text-xs text-text-muted">
              Next: {schedule.events[0].event_time} {schedule.events[0].title}
            </p>
          ) : null}
        </SummaryLink>

        <SummaryLink href={`${base}/gear`} label="Gear" icon={Backpack}>
          <p className="text-lg font-semibold text-text-main">
            {packedCount}/{gear.length} packed
          </p>
          <p className="mt-1 text-xs text-text-muted">{acquiredCount} acquired</p>
          <p className="mt-2 text-xs text-text-muted">
            {criticalUnresolved === 0
              ? 'No critical gaps'
              : `${criticalUnresolved} critical unresolved`}
          </p>
        </SummaryLink>

        <SummaryLink href={`${base}/crew`} label="Crew" icon={Users}>
          {showCrew ? (
            <>
              <p className="text-lg font-semibold text-text-main">
                {crew.length} member{crew.length === 1 ? '' : 's'}
              </p>
              <p className="mt-1 text-xs text-text-muted">
                {assignedLoad.toFixed(1)} kg assigned load
              </p>
              {crew.length > 0 ? (
                <p className="mt-2 truncate text-xs text-text-muted">
                  {crew.map((member) => member.role || member.name).join(' · ')}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-text-muted">Hidden for this trip</p>
          )}
        </SummaryLink>

        <SummaryLink href={`${base}/guide`} label="Field Guide" icon={Compass}>
          <p className="text-lg font-semibold text-text-main">
            {alerts.length} active notice{alerts.length === 1 ? '' : 's'}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            {parkIntel ? 'Park details available' : 'Park details unavailable'}
          </p>
          <p className="mt-2 text-xs text-text-muted">
            {showOffline
              ? offlineStatus
                ? 'Offline checklist started'
                : 'Offline status unavailable'
              : showAstro && hasAstro
                ? 'Night-sky details available'
                : 'Optional guide modules hidden'}
          </p>
        </SummaryLink>

        <SummaryLink href={`${base}/field-log`} label="Field Log" icon={BookOpenText}>
          <p className="text-lg font-semibold text-text-main">
            {prepFeed.length} photo{prepFeed.length === 1 ? '' : 's'}
          </p>
          <p className="mt-1 line-clamp-2 text-xs text-text-muted">
            {latestPrep?.caption || 'No preparation photos yet'}
          </p>
        </SummaryLink>
      </div>
    </section>
  );
}
