import GuardedTripLink from '@/components/trip/GuardedTripLink';
import type { HomeScheduleSummary } from './homeSelectors';
import { Card } from '@/components/ui/Primitives';
import { CalendarClock, ChevronRight, Clock3 } from 'lucide-react';

export default function TodaySummaryCard({
  summary,
  href,
}: {
  summary: HomeScheduleSummary;
  href: string;
}) {
  return (
    <Card
      title={`${summary.label} · Day ${summary.dayNumber}`}
      icon={CalendarClock}
      className="home-today-card h-full"
      action={
        <GuardedTripLink
          href={href}
          className="home-today-header-action inline-flex items-center gap-1 rounded text-xs font-medium text-accent-yellow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          aria-label="View full trip plan"
        >
          Full plan <ChevronRight size={14} aria-hidden="true" />
        </GuardedTripLink>
      }
    >
      {summary.events.length > 0 ? (
        <ol className="today-timeline">
          {summary.events.map((event, index) => (
            <li
              key={event.id}
              className={`today-timeline__item ${
                index === 0 ? 'today-timeline__item--next' : ''
              }`}
            >
              <span className="today-timeline__time">
                <Clock3 size={12} aria-hidden="true" />
                {event.event_time}
              </span>
              <span className="today-timeline__marker" aria-hidden="true" />
              <div className="min-w-0">
                <h3 className="break-words text-sm font-semibold text-text-main">
                  {event.title}
                </h3>
                <p className="mt-0.5 break-words text-[11px] font-mono text-text-muted">
                  {event.phase === null ? 'Uncategorized' : event.phase}
                </p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border-subtle px-5 py-8 text-center">
          <p className="text-sm text-text-muted">
            {summary.label === 'Trip complete'
              ? 'No events were recorded for the final trip day.'
              : 'No events are planned for this day yet.'}
          </p>
          <GuardedTripLink
            href={href}
            className="mt-3 rounded text-sm font-medium text-accent-yellow underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            Open Plan
          </GuardedTripLink>
        </div>
      )}
      {summary.events.length > 0 && (
        <GuardedTripLink href={href} className="home-today-footer-action">
          <span>View full plan</span>
          <ChevronRight size={14} aria-hidden="true" />
        </GuardedTripLink>
      )}
    </Card>
  );
}
