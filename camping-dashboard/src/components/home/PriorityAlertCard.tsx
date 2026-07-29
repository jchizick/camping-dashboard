import GuardedTripLink from '@/components/trip/GuardedTripLink';
import type { Alert } from '@/types';
import { Card } from '@/components/ui/Primitives';
import { AlertTriangle, CheckCircle2, ChevronRight, Info } from 'lucide-react';

const NOTICE_PREFIX = /^(?:park\s+)?notice\s+(?:for|about)\s+/i;
const CORRIDOR_CAMPGROUNDS = /\s+corridor\s+campgrounds?\b/i;
const ASSISTANCE_SIGNAL = /\b(?:assistance|help)\b/i;
const CONTACT_SIGNAL = /\b(?:call|contact|text|warden|park staff)\b/i;

function alertTone(severity: Alert['severity']) {
  if (severity === 'critical') {
    return {
      icon: AlertTriangle,
      className: 'border-accent-red/30 bg-accent-red/5',
    };
  }
  if (severity === 'info' || severity === 'advisory') {
    return {
      icon: Info,
      className: 'border-accent-blue/30 bg-accent-blue/5',
    };
  }
  return {
    icon: AlertTriangle,
    className: 'border-accent-yellow/30 bg-accent-yellow/5',
  };
}

function updatedLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('en-CA', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function truncateAtWordBoundary(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;

  const candidate = value.slice(0, maxLength + 1);
  const lastWordBoundary = candidate.lastIndexOf(' ');
  const summary = candidate.slice(0, Math.max(lastWordBoundary, 0)).trimEnd();
  return summary ? `${summary}…` : value;
}

export function priorityAlertDisplayTitle(
  title: string,
  body: string,
  maxLength = 64
) {
  const normalized = title.replace(/\s+/g, ' ').trim();
  const withoutPrefix = normalized.replace(NOTICE_PREFIX, '');
  const colonIndex = withoutPrefix.indexOf(':');

  if (colonIndex > 0) {
    const remainder = withoutPrefix.slice(colonIndex + 1);
    let topic = withoutPrefix.slice(0, colonIndex).trim();
    const assistanceNotice =
      ASSISTANCE_SIGNAL.test(`${remainder} ${body}`) &&
      CONTACT_SIGNAL.test(`${remainder} ${body}`);

    if (assistanceNotice) {
      topic = topic.replace(CORRIDOR_CAMPGROUNDS, ' Campground');
      if (!ASSISTANCE_SIGNAL.test(topic)) {
        topic = `${topic} Assistance`;
      }
    }

    if (topic.length >= 12 && topic.length <= maxLength) return topic;
  }

  return truncateAtWordBoundary(withoutPrefix, maxLength);
}

export function priorityAlertSummary(
  body: string,
  maxLength = 132,
  canonicalTitle = ''
) {
  const normalized = body.replace(/\s+/g, ' ').trim();
  const normalizedTitle = canonicalTitle.replace(/\s+/g, ' ').trim();
  const withoutRepeatedTitle =
    normalizedTitle && normalized.toLocaleLowerCase().startsWith(normalizedTitle.toLocaleLowerCase())
      ? normalized.slice(normalizedTitle.length).replace(/^[\s:–—-]+/, '').trim()
      : normalized;
  const semanticSource = `${normalizedTitle} ${withoutRepeatedTitle}`;

  if (
    ASSISTANCE_SIGNAL.test(semanticSource) &&
    CONTACT_SIGNAL.test(semanticSource)
  ) {
    return 'Park staff contact information is available for campers who need help.';
  }

  const firstSentence = withoutRepeatedTitle.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim();
  const presentationCopy =
    firstSentence && firstSentence.length >= 24 ? firstSentence : withoutRepeatedTitle;
  return truncateAtWordBoundary(presentationCopy, maxLength);
}

export default function PriorityAlertCard({
  alert,
  href,
}: {
  alert: Alert | null;
  href: string;
}) {
  if (!alert) {
    return (
      <Card
        title="Priority notice"
        icon={CheckCircle2}
        className="home-priority-card h-full"
      >
        <div className="flex flex-1 items-center gap-3 rounded-xl border border-accent-green/20 bg-accent-green/5 p-4">
          <CheckCircle2 className="shrink-0 text-accent-green" size={22} />
          <div>
            <h3 className="text-sm font-semibold text-text-main">No active notices</h3>
            <p className="mt-1 text-xs text-text-muted">
              No current advisories require attention.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const tone = alertTone(alert.severity);
  const Icon = tone.icon;
  const updated = updatedLabel(alert.updated_at);
  const displayTitle = priorityAlertDisplayTitle(alert.title, alert.body);
  const displaySummary = priorityAlertSummary(alert.body, 132, alert.title);

  return (
    <Card
      title="Priority notice"
      icon={AlertTriangle}
      className="home-priority-card h-full"
      action={
        <GuardedTripLink
          href={href}
          className="inline-flex items-center gap-1 rounded text-xs font-medium text-accent-yellow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          aria-label="View all field guide notices"
        >
          Field Guide <ChevronRight size={14} aria-hidden="true" />
        </GuardedTripLink>
      }
    >
      <div
        className={`flex flex-1 flex-col justify-center rounded-xl border p-3.5 ${tone.className}`}
        role="status"
        aria-label={`${alert.severity} priority notice: ${displayTitle}`}
      >
        <div className="home-priority-card__severity mb-2 flex items-center gap-2">
          <span className="inline-flex items-center gap-2 text-sm font-semibold capitalize text-text-main">
            <Icon size={18} className="shrink-0" aria-hidden="true" />
            {alert.severity}
          </span>
        </div>
        <h3 className="home-priority-card__title line-clamp-2 text-[0.95rem] font-bold leading-snug text-text-main">
          {displayTitle}
        </h3>
        <p className="home-priority-card__summary mt-1.5 line-clamp-2 text-[0.8rem] leading-relaxed text-text-muted">
          {displaySummary}
        </p>
        {updated ? (
          <p className="home-priority-card__updated mt-2.5 text-[11px] text-text-muted">
            Updated {updated}
          </p>
        ) : null}
        <GuardedTripLink
          href={href}
          className="home-priority-card__inline-action items-center gap-1 rounded-lg border border-current/25 px-3 text-xs font-medium text-text-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          aria-label="View priority notice in Field Guide"
        >
          View in Field Guide <ChevronRight size={14} aria-hidden="true" />
        </GuardedTripLink>
      </div>
    </Card>
  );
}
