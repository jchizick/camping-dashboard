'use client';

import type { CSSProperties } from 'react';
import MapRouteCard from '@/components/cards/MapRouteCard';
import type { CampsiteSelection } from '@/components/maps/CampsiteMapSelector';
import { formatPlanDateRange } from '@/components/plan/planViewModel';
import GuardedTripLink from '@/components/trip/GuardedTripLink';
import { useOptionalTripWorkspaceStatus } from '@/components/trip/TripWorkspaceStatus';
import DesktopConditions from './DesktopConditions';
import { formatTripDuration, getTripDuration } from '@/lib/tripDuration';
import type { HomeViewModel } from './homeViewModel';
import './desktopWorkspaceOverview.css';

const READINESS_LANDMARKS = [25, 50, 75, 100] as const;
const READINESS_SEGMENTS = Array.from({ length: 20 }, (_, index) => index);

function DesktopReadinessGauge({ score, statusLabel }: { score: number; statusLabel: string }) {
  const markerEdge = score === 0 ? 'start' : score === 100 ? 'end' : 'middle';
  const filledSegmentCount = Math.round((score / 100) * READINESS_SEGMENTS.length);

  return <div className="mobile-readiness-gauge" data-readiness-gauge role="progressbar"
    aria-label="Overall trip readiness" aria-valuemin={0} aria-valuemax={100}
    aria-valuenow={score} aria-valuetext={`${score}% · ${statusLabel}`}>
    <div className="mobile-readiness-gauge__track" aria-hidden="true">
      <span className="mobile-readiness-gauge__segments" data-readiness-fill
        data-filled-segments={filledSegmentCount}>
        {READINESS_SEGMENTS.map(segment => <span
          className={segment < filledSegmentCount ? 'is-filled' : undefined}
          data-readiness-segment key={segment}
          style={{ '--readiness-segment-color': `color-mix(in srgb, var(--workspace-accent-amber) ${100 - Math.round((segment / (READINESS_SEGMENTS.length - 1)) * 58)}%, var(--workspace-accent-sage))` } as CSSProperties}
        />)}
      </span>
      <span className="mobile-readiness-gauge__threshold" data-readiness-threshold />
      <span className="mobile-readiness-gauge__marker" data-edge={markerEdge}
        data-readiness-marker style={{ left: `${score}%` }}>
        <span aria-hidden="true" className="mobile-readiness-gauge__marker-notch" data-readiness-marker-notch />
      </span>
    </div>
    <span className="mobile-readiness-gauge__landmarks" aria-hidden="true">
      {READINESS_LANDMARKS.map(landmark => <span key={landmark}>{landmark}%</span>)}
    </span>
  </div>;
}

/** Summary-only desktop composition; domain state and priority remain canonical. */
export default function DesktopWorkspaceOverview({ model, onSaveLocation, onRefreshWeather }: {
  model: HomeViewModel;
  onRefreshWeather?: () => Promise<void>;
  onSaveLocation?: (selection: CampsiteSelection) => Promise<void>;
}) {
  const workspace = useOptionalTripWorkspaceStatus();
  const cached = workspace?.source === 'cache';
  const { trip, readiness, schedule, conditions } = model;
  const duration = getTripDuration(trip.start_date, trip.end_date);
  const priority = readiness.primaryPriority;
  const attention = priority ?? model.setup;
  const status = schedule.label === 'Next up' ? 'Trip is approaching'
    : schedule.label === 'Trip complete' ? 'Trip complete' : 'Trip is underway';
  // These events are in planner order for the selected day, not future-time order.
  const scheduleLabel = schedule.label === 'Next up' ? 'First planned day'
    : schedule.label === 'Trip complete' ? 'Final day' : 'Today';

  return (
    <section className="desktop-workspace-overview" data-home-composition="desktop"
      data-desktop-workspace-overview aria-labelledby="desktop-overview-title">
      <header className="dwo-identity">
        <p className="dwo-label">Overview <span>{status}</span></p>
        <h1 id="desktop-overview-title" tabIndex={-1}>{trip.name}</h1>
        <p className="dwo-location">{[trip.park_name, trip.lake_name, trip.site_name].filter(Boolean).join(' · ') || 'Campsite unavailable'}</p>
        <p className="dwo-meta">{formatPlanDateRange(trip.start_date, trip.end_date)}{duration ? ` · ${formatTripDuration(duration)}` : ''}</p>
      </header>

      <section className="dwo-readiness" aria-labelledby="dwo-readiness-title">
        <h2 id="dwo-readiness-title">Readiness</h2>
        <div className="dwo-score-line">
          <strong className="dwo-score">{readiness.score === null ? '—' : `${readiness.score}%`}</strong>
          <span>{readiness.statusLabel}</span>
        </div>
        {readiness.score !== null ? <DesktopReadinessGauge score={readiness.score} statusLabel={readiness.statusLabel} /> :
          <p className="dwo-meta">Not enough information to assess readiness.</p>}
        {readiness.assessmentCoverage === 'partial' && <p className="dwo-meta">Partial assessment · some required information is missing.</p>}
      </section>

      <div className="dwo-map" data-home-module="map">
        <MapRouteCard trip={trip} onSaveLocation={onSaveLocation} />
      </div>

      <div className="dwo-operations">
        <section className="dwo-attention" aria-labelledby="dwo-attention-title" data-attention={Boolean(attention)}>
          <h2 id="dwo-attention-title">{attention ? 'Needs attention' : 'Readiness check'}</h2>
          {attention ? <>
            <h3>{attention.title}</h3>
            <p>{attention.description}</p>
            {attention.action && <GuardedTripLink href={attention.action.href}>{attention.action.label} <span aria-hidden="true">↗</span></GuardedTripLink>}
          </> : <p>{readiness.assessmentCoverage === 'complete' ? 'No unresolved readiness items.' : 'Readiness assessment is incomplete.'}</p>}
        </section>
        <section className="dwo-schedule" aria-labelledby="dwo-schedule-title">
          <div className="dwo-section-heading"><h2 id="dwo-schedule-title">Schedule</h2><GuardedTripLink href={model.hrefs.plan}>Open Plan</GuardedTripLink></div>
          <p className="dwo-meta">{scheduleLabel} · Day {schedule.dayNumber} · planner order</p>
          {schedule.events.length ? <ol>{schedule.events.slice(0, 2).map(event => <li key={event.id}><span className="dwo-event-time">{event.event_time}</span><h3>{event.title}</h3></li>)}</ol> :
            <p>{schedule.label === 'Trip complete' ? 'No events were recorded for the final trip day.' : 'No events are planned for this day yet.'}</p>}
          {schedule.events.length > 2 && <p className="dwo-meta">More in Plan</p>}
        </section>
      </div>

      <DesktopConditions conditions={conditions} onRefresh={onRefreshWeather} />
      {model.notice && <aside className="dwo-notice" aria-label="Trip notice" data-severity={model.notice.severity}>
        <span className="dwo-label">{cached ? 'Saved notice' : 'Trip notice'}</span>
        <span>{model.notice.title}</span>
        <GuardedTripLink href={model.hrefs.field}>Review in Field</GuardedTripLink>
        {cached && <small>Cached · may have changed</small>}
      </aside>}
    </section>
  );
}
