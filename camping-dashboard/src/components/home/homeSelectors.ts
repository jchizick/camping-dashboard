import type { Alert, TimelineEvent, TripDashboard } from '@/types';

export interface HomeScheduleSummary {
  label: 'Today' | 'Next up' | 'Trip complete';
  dayNumber: number;
  events: TimelineEvent[];
}

const ALERT_PRIORITY: Record<Alert['severity'], number> = {
  critical: 5,
  warning: 4,
  watch: 3,
  advisory: 2,
  info: 1,
};

function calendarOrdinal(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

function dateStringOrdinal(value: string): number {
  const [year, month, day] = value.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

export function getVisibleAlerts(alerts: Alert[]): Alert[] {
  return alerts.filter((alert) => alert.is_active && !alert.dismissed_at);
}

export function getPriorityAlert(alerts: Alert[]): Alert | null {
  let selected: Alert | null = null;

  for (const alert of alerts) {
    if (!alert.is_active || alert.dismissed_at) continue;
    if (!selected) {
      selected = alert;
      continue;
    }

    const priorityDifference =
      ALERT_PRIORITY[alert.severity] - ALERT_PRIORITY[selected.severity];
    if (
      priorityDifference > 0 ||
      (priorityDifference === 0 &&
        Date.parse(alert.created_at) > Date.parse(selected.created_at))
    ) {
      selected = alert;
    }
  }

  return selected;
}

export function getHomeScheduleSummary({
  trip,
  tripDays,
  timeline,
  now = new Date(),
  limit = 4,
}: {
  trip: Pick<TripDashboard, 'start_date' | 'end_date'>;
  tripDays: number;
  timeline: TimelineEvent[];
  now?: Date;
  limit?: number;
}): HomeScheduleSummary {
  const start = dateStringOrdinal(trip.start_date);
  const end = dateStringOrdinal(trip.end_date);
  const today = calendarOrdinal(now);
  const lastDay = Math.max(tripDays, 1);

  let label: HomeScheduleSummary['label'];
  let dayNumber: number;

  if (today < start) {
    label = 'Next up';
    let earliestEventDay = 1;
    if (timeline.length > 0) {
      earliestEventDay = lastDay;
      for (const event of timeline) {
        if (event.day_number < earliestEventDay) earliestEventDay = event.day_number;
      }
    }
    dayNumber = Math.max(1, Math.min(earliestEventDay, lastDay));
  } else if (today > end) {
    label = 'Trip complete';
    dayNumber = lastDay;
  } else {
    label = 'Today';
    const elapsedDays = Math.floor((today - start) / 86_400_000);
    dayNumber = Math.max(1, Math.min(elapsedDays + 1, lastDay));
  }

  const events = timeline
    .filter((event) => event.day_number === dayNumber)
    .toSorted((left, right) => left.sort_order - right.sort_order)
    .slice(0, limit);

  return { label, dayNumber, events };
}
