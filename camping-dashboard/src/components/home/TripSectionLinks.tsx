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
  tone,
  children,
}: {
  href: string;
  label: string;
  icon: typeof CalendarDays;
  tone: 'plan' | 'gear' | 'crew' | 'guide' | 'field-log';
  children: React.ReactNode;
}) {
  return (
    <GuardedTripLink
      href={href}
      aria-label={`Open ${label}`}
      className={`workspace-summary-link home-glass-surface--navigation workspace-summary-link--${tone} group flex min-h-32 flex-col border p-3.5 transition-[background-color,border-color,box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex min-w-0 items-center gap-3 text-base font-semibold text-text-main">
          <span className="workspace-summary-link__icon grid h-10 w-10 shrink-0 place-items-center rounded-full">
            <Icon size={20} aria-hidden="true" />
          </span>
          <span className="truncate">{label}</span>
        </span>
        <ChevronRight
          size={16}
          className="text-text-muted transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </div>
      <div className="workspace-summary-link__content mt-3 flex flex-1 flex-col justify-end">
        {children}
      </div>
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
    <section aria-labelledby="trip-workspaces-heading" className="home-workspace-section">
      <div>
        <h2 id="trip-workspaces-heading" className="text-xl font-bold text-text-main">
          Trip workspaces
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Continue planning in a dedicated section.
        </p>
      </div>

      <div className="workspace-summary-grid">
        <SummaryLink href={`${base}/plan`} label="Plan" icon={CalendarDays} tone="plan">
          <p className="workspace-summary-link__metric">
            {timeline.length} event{timeline.length === 1 ? '' : 's'}
          </p>
          <p className="workspace-summary-link__support mt-1">
            {tripDays} trip day{tripDays === 1 ? '' : 's'}
            {showMeals ? ` · ${meals.length} meals` : ''}
          </p>
          {schedule.events[0] ? (
            <p className="workspace-summary-link__support mt-1.5 truncate">
              Next: {schedule.events[0].event_time} {schedule.events[0].title}
            </p>
          ) : null}
        </SummaryLink>

        <SummaryLink href={`${base}/gear`} label="Gear" icon={Backpack} tone="gear">
          <p className="workspace-summary-link__metric">
            {packedCount}/{gear.length} packed
          </p>
          <p className="workspace-summary-link__support mt-1">{acquiredCount} acquired</p>
          <p className="workspace-summary-link__support mt-1.5">
            {criticalUnresolved === 0
              ? 'No critical gaps'
              : `${criticalUnresolved} critical unresolved`}
          </p>
        </SummaryLink>

        <SummaryLink href={`${base}/crew`} label="Crew" icon={Users} tone="crew">
          {showCrew ? (
            <>
              <p className="workspace-summary-link__metric">
                {crew.length} member{crew.length === 1 ? '' : 's'}
              </p>
              <p className="workspace-summary-link__support mt-1">
                {assignedLoad.toFixed(1)} kg assigned load
              </p>
              {crew.length > 0 ? (
                <p className="workspace-summary-link__support mt-1.5 truncate">
                  {crew.map((member) => member.role || member.name).join(' · ')}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-text-muted">Hidden for this trip</p>
          )}
        </SummaryLink>

        <SummaryLink href={`${base}/guide`} label="Field Guide" icon={Compass} tone="guide">
          <p className="workspace-summary-link__metric">
            {alerts.length} active notice{alerts.length === 1 ? '' : 's'}
          </p>
          <p className="workspace-summary-link__support mt-1">
            {parkIntel ? 'Park details available' : 'Park details unavailable'}
          </p>
          <p className="workspace-summary-link__support mt-1.5">
            {showOffline
              ? offlineStatus
                ? 'Offline checklist started'
                : 'Offline status unavailable'
              : showAstro && hasAstro
                ? 'Night-sky details available'
                : 'Optional guide modules hidden'}
          </p>
        </SummaryLink>

        <SummaryLink
          href={`${base}/field-log`}
          label="Field Log"
          icon={BookOpenText}
          tone="field-log"
        >
          <p className="workspace-summary-link__metric">
            {prepFeed.length} photo{prepFeed.length === 1 ? '' : 's'}
          </p>
          <p className="workspace-summary-link__support mt-1 line-clamp-2">
            {latestPrep?.caption || 'No preparation photos yet'}
          </p>
        </SummaryLink>
      </div>
    </section>
  );
}
