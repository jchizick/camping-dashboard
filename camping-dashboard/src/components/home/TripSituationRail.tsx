import type { ReadinessScore, WeatherCurrent } from '@/types';
import { Activity, CalendarClock, CloudSun, Sunset } from 'lucide-react';
import type { HomeScheduleSummary } from './homeSelectors';

function metricValue(value: string | number | null | undefined, suffix = '') {
  return value === null || value === undefined || value === ''
    ? 'Unavailable'
    : `${value}${suffix}`;
}

export default function TripSituationRail({
  weather,
  readiness,
  schedule,
}: {
  weather: WeatherCurrent | null;
  readiness: ReadinessScore;
  schedule: HomeScheduleSummary;
}) {
  const nextEvent = schedule.events[0] ?? null;

  const metrics = [
    {
      key: 'weather',
      label: 'Weather',
      icon: CloudSun,
      value: weather ? `${Math.round(weather.temperature_c)}°C` : 'Unavailable',
      detail: weather?.condition_label ?? 'Current conditions unavailable',
    },
    {
      key: 'readiness',
      label: 'Readiness',
      icon: Activity,
      value: `${readiness.overall}%`,
      detail: readiness.label,
      progress: readiness.overall,
    },
    {
      key: 'sunset',
      label: 'Sunset',
      icon: Sunset,
      value: metricValue(weather?.sunset_time),
      detail: weather?.sunset_time ? 'Local campsite time' : 'Sunset unavailable',
    },
    {
      key: 'next-event',
      label: 'Next event',
      icon: CalendarClock,
      value: nextEvent?.event_time || 'Unavailable',
      detail: nextEvent?.title ?? 'No event scheduled',
    },
  ];

  return (
    <section className="trip-situation-rail" aria-label="Current trip situation">
      {metrics.map(({ key, label, icon: Icon, value, detail, progress }) => (
        <div
          key={key}
          className={`trip-situation-rail__item trip-situation-rail__item--${key}`}
          {...(progress === undefined
            ? {}
            : {
                role: 'progressbar',
                'aria-label': 'Current trip readiness',
                'aria-valuemin': 0,
                'aria-valuemax': 100,
                'aria-valuenow': progress,
                'aria-valuetext': `${progress}% · ${detail}`,
              })}
        >
          <Icon aria-hidden="true" />
          <div className="min-w-0">
            <p className="trip-situation-rail__label">{label}</p>
            <p className="trip-situation-rail__value">{value}</p>
            <p className="trip-situation-rail__detail">{detail}</p>
          </div>
        </div>
      ))}
    </section>
  );
}
