import GuardedTripLink from '@/components/trip/GuardedTripLink';
import MapRouteCard from '@/components/cards/MapRouteCard';
import type { CampsiteSelection } from '@/components/maps/CampsiteMapSelector';
import type {
  ReadinessCoverageReason,
  ReadinessResult,
} from '@/lib/readiness';
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock3,
  CloudSun,
  Info,
  Sunset,
} from 'lucide-react';
import PriorityAlertCard from './PriorityAlertCard';
import ReadinessGauge from './ReadinessGauge';
import TripHero from './TripHero';
import type { HomeSetupContext, HomeViewModel } from './homeViewModel';
import { useOptionalTripWorkspaceStatus } from '@/components/trip/TripWorkspaceStatus';
import { cachedWeatherPresentation } from '@/lib/offlineFreshness';

function coverageReasonLabel(reason: ReadinessCoverageReason): string {
  if (reason === 'required-gear-not-identified') {
    return "Required gear hasn't been identified yet.";
  }
  return 'More preparation information is needed to complete readiness.';
}

function MobileReadinessCommandCentre({
  readiness,
  setup,
  canSetupRequiredGear,
}: {
  readiness: ReadinessResult;
  setup: HomeSetupContext | null;
  canSetupRequiredGear: boolean;
}) {
  const coverageIssue = readiness.coverageIssues[0] ?? null;
  const hasBlockers = readiness.blockers.length > 0;
  const hasWarnings = readiness.warnings.length > 0;
  const hasPriority = readiness.primaryPriority !== null;
  const isPartial = readiness.assessmentCoverage === 'partial';
  const isUnavailable = readiness.assessmentCoverage === 'unavailable';
  const action = setup
    ? canSetupRequiredGear
      ? setup.action
      : null
    : readiness.nextAction ?? coverageIssue?.action ?? null;

  let issueLabel = 'Preparation complete';
  let issueTitle = 'Required preparation is complete.';
  let issueDescription = 'Keep an eye on trip conditions as departure approaches.';
  let issueTone = 'ready';
  let IssueIcon = CheckCircle2;

  if (setup) {
    issueLabel = 'Assessment setup';
    issueTitle = setup.title;
    issueDescription = setup.description;
    issueTone = 'coverage';
    IssueIcon = Info;
  } else if (hasBlockers) {
    issueLabel = `${readiness.blockers.length} ${
      readiness.blockers.length === 1 ? 'blocker' : 'blockers'
    }`;
    issueTitle = readiness.primaryPriority?.title ?? 'Preparation is blocked.';
    issueDescription =
      readiness.primaryPriority?.description ??
      'Resolve the highest-priority preparation issue before departure.';
    issueTone = 'blocker';
    IssueIcon = AlertTriangle;
  } else if (hasWarnings) {
    issueLabel = `${readiness.warnings.length} ${
      readiness.warnings.length === 1 ? 'warning' : 'warnings'
    }`;
    issueTitle = readiness.primaryPriority?.title ?? 'Preparation needs attention.';
    issueDescription =
      readiness.primaryPriority?.description ??
      'Review the highest-priority preparation item.';
    issueTone = 'warning';
    IssueIcon = AlertTriangle;
  } else if (isPartial && coverageIssue) {
    issueLabel = 'Assessment gap';
    issueTitle = coverageReasonLabel(coverageIssue.reason);
    issueDescription =
      'Review Gear to complete the trip readiness assessment.';
    issueTone = 'coverage';
    IssueIcon = Info;
  } else if (isUnavailable) {
    issueLabel = 'Assessment unavailable';
    issueTitle = 'Not enough preparation information is available yet.';
    issueDescription =
      'Add required gear or another preparation signal to calculate readiness.';
    issueTone = 'unavailable';
    IssueIcon = Info;
  }

  const showPrimaryScore =
    readiness.score !== null && readiness.assessmentCoverage === 'complete';

  return (
    <section
      className="mobile-readiness-command"
      data-home-module="readiness-command"
      data-readiness-status={readiness.status}
      aria-labelledby="mobile-readiness-title"
    >
      <div className="mobile-readiness-command__eyebrow">
        <Activity size={15} aria-hidden="true" />
        Readiness command
      </div>

      <div
        className="mobile-readiness-command__status"
        data-comparable={showPrimaryScore ? 'true' : 'false'}
      >
        {showPrimaryScore ? (
          <p
            className="mobile-readiness-command__score"
            data-mobile-type-role="readiness-score"
            aria-hidden="true"
          >
            {readiness.score}
            <span>%</span>
          </p>
        ) : null}
        <div>
          <h2 id="mobile-readiness-title" data-mobile-type-role="readiness-state">
            {readiness.statusLabel}
          </h2>
          {isPartial && readiness.score !== null ? (
            <p className="mobile-readiness-command__assessed-score">
              {readiness.score}% of assessed preparation is complete.
            </p>
          ) : isUnavailable ? (
            <p className="mobile-readiness-command__assessed-score">
              No readiness score is available.
            </p>
          ) : (
            <p className="mobile-readiness-command__assessed-score">
              Overall trip readiness
            </p>
          )}
        </div>
      </div>

      {showPrimaryScore && readiness.score !== null ? (
        <ReadinessGauge
          score={readiness.score}
          statusLabel={readiness.statusLabel}
        />
      ) : null}

      <div
        className="mobile-readiness-command__issue"
        data-tone={issueTone}
        role="status"
      >
        <IssueIcon size={20} aria-hidden="true" />
        <div>
          <p className="mobile-readiness-command__issue-label">{issueLabel}</p>
          <h3>{issueTitle}</h3>
          <p>{issueDescription}</p>
        </div>
      </div>

      {!setup && isPartial && coverageIssue && hasPriority ? (
        <p className="mobile-readiness-command__coverage-note">
          <Info size={15} aria-hidden="true" />
          {coverageReasonLabel(coverageIssue.reason)}
        </p>
      ) : null}

      {action ? (
        <GuardedTripLink
          href={action.href}
          className="mobile-readiness-command__action"
          aria-label={action.label}
        >
          <span>
            <small>Next action</small>
            {action.label}
          </span>
          <ChevronRight size={19} aria-hidden="true" />
        </GuardedTripLink>
      ) : null}
    </section>
  );
}

function MobileTripContext({ model }: { model: HomeViewModel }) {
  const weather = model.conditions.currentWeather;
  const workspace = useOptionalTripWorkspaceStatus();
  const cachedPresentation = workspace?.source === 'cache'
    ? cachedWeatherPresentation(
        weather,
        model.conditions.weatherRefresh,
        model.conditions.forecast
      )
    : null;
  if (!weather && !model.nextEvent) return null;

  return (
    <section
      className="mobile-trip-context"
      data-home-module="trip-context"
      aria-label="Trip context"
    >
      <article className="mobile-trip-context__item">
        <CloudSun aria-hidden="true" />
        <div>
          <p className="mobile-trip-context__label">
            {cachedPresentation?.isPrevious ? 'Previous conditions' : 'Conditions'}
          </p>
          {weather ? (
            <>
              <p className="mobile-trip-context__value">
                {Math.round(weather.temperature_c)}°C · {weather.condition_label}
              </p>
              <p className="mobile-trip-context__detail">
                {weather.rain_chance === null
                  ? 'Rain chance unavailable'
                  : `${weather.rain_chance}% rain chance`}
                {weather.sunset_time ? (
                  <span>
                    <Sunset size={12} aria-hidden="true" />
                    Sunset {weather.sunset_time}
                  </span>
                ) : null}
              </p>
              {cachedPresentation ? (
                <p
                  className="mobile-trip-context__detail"
                  title={cachedPresentation.exactTimestamp ?? undefined}
                >
                  {cachedPresentation.label}
                </p>
              ) : null}
            </>
          ) : (
            <p className="mobile-trip-context__value">Conditions unavailable</p>
          )}
        </div>
      </article>

      {model.nextEvent ? (
        <article className="mobile-trip-context__item">
          <CalendarClock aria-hidden="true" />
          <div>
            <p className="mobile-trip-context__label">Next</p>
            <p className="mobile-trip-context__value">{model.nextEvent.title}</p>
            <p className="mobile-trip-context__detail">
              <Clock3 size={12} aria-hidden="true" />
              {model.nextEvent.event_time} · Day {model.schedule.dayNumber}
            </p>
          </div>
        </article>
      ) : null}
    </section>
  );
}

function MobileSchedulePreview({ model }: { model: HomeViewModel }) {
  if (model.laterEvents.length === 0) return null;

  return (
    <section
      className="mobile-home-schedule"
      data-home-module="day-plan"
      aria-labelledby="mobile-schedule-title"
    >
      <div className="mobile-home-section-heading">
        <div>
          <p>Today</p>
          <h2 id="mobile-schedule-title">Later on Day {model.schedule.dayNumber}</h2>
        </div>
        <GuardedTripLink href={model.hrefs.plan} aria-label="View full trip plan">
          Full plan <ChevronRight size={14} aria-hidden="true" />
        </GuardedTripLink>
      </div>
      <ol>
        {model.laterEvents.map((event) => (
          <li key={event.id}>
            <time>{event.event_time}</time>
            <span aria-hidden="true" />
            <div>
              <h3>{event.title}</h3>
              <p>{event.phase ?? 'Uncategorized'}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function MobileHomeOverview({
  model,
  onSaveLocation,
  canSetupRequiredGear = false,
}: {
  model: HomeViewModel;
  onSaveLocation?: (selection: CampsiteSelection) => Promise<void>;
  canSetupRequiredGear?: boolean;
}) {
  const showMap = model.hasCampsiteContext || Boolean(onSaveLocation);

  return (
    <div
      className="home-overview mobile-home-overview"
      data-home-composition="mobile"
    >
      <div className="home-heading-region">
        <TripHero trip={model.trip} />
      </div>

      <MobileReadinessCommandCentre
        readiness={model.readiness}
        setup={model.setup}
        canSetupRequiredGear={canSetupRequiredGear}
      />
      <MobileTripContext model={model} />
      <MobileSchedulePreview model={model} />

      {model.notice ? (
        <div
          className="home-priority mobile-home-notice"
          data-home-module="trip-notice"
        >
          <PriorityAlertCard alert={model.notice} href={model.hrefs.field} />
        </div>
      ) : null}

      {showMap ? (
        <section
          className="home-map mobile-home-map"
          data-home-module="map"
          aria-label="Campsite context"
        >
          <MapRouteCard
            trip={model.trip}
            onSaveLocation={onSaveLocation}
            variant="home"
          />
        </section>
      ) : null}
    </div>
  );
}
