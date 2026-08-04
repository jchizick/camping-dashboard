import type { CSSProperties } from 'react';
import GuardedTripLink from '@/components/trip/GuardedTripLink';
import type { ReadinessScore } from '@/types';
import { Card } from '@/components/ui/Primitives';
import { Activity, ChevronRight } from 'lucide-react';

const READINESS_CATEGORIES = [
  { key: 'gear' as const, label: 'Gear' },
  { key: 'meals' as const, label: 'Meals' },
  { key: 'offline' as const, label: 'Offline' },
  { key: 'weather' as const, label: 'Weather' },
  { key: 'timeline' as const, label: 'Plan' },
];

function readinessInterpretation(score: number) {
  if (score >= 85) return 'Core trip preparations are in strong shape.';
  if (score >= 65) return 'A few preparation gaps still need attention.';
  return 'Resolve the lowest readiness areas before departure.';
}

export default function ReadinessSummaryCard({
  readiness,
  href,
  showMeals,
  showOffline,
}: {
  readiness: ReadinessScore;
  href: string;
  showMeals: boolean;
  showOffline: boolean;
}) {
  const lowestCategories = READINESS_CATEGORIES
    .filter(({ key }) => (key !== 'meals' || showMeals) && (key !== 'offline' || showOffline))
    .toSorted((left, right) => readiness[left.key] - readiness[right.key])
    .slice(0, 3);

  return (
    <Card
      title="Readiness"
      icon={Activity}
      className="home-readiness-card home-glass-surface home-glass-surface--dense h-full"
      action={
        <GuardedTripLink
          href={href}
          className="home-action-link home-readiness-header-action inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          aria-label="View gear"
          title="View gear"
        >
          <span className="home-readiness-header-action__label">View gear</span>
          <ChevronRight size={14} aria-hidden="true" />
        </GuardedTripLink>
      }
    >
      <div className="flex items-center gap-3.5">
        <div
          className="readiness-ring"
          role="progressbar"
          aria-label="Overall trip readiness"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={readiness.overall}
          aria-valuetext={`${readiness.overall}% · ${readiness.label}`}
          style={{ '--readiness-value': readiness.overall } as CSSProperties}
        >
          <span className="text-2xl font-bold text-text-main">{readiness.overall}%</span>
        </div>
        <div className="min-w-0">
          <p className="text-base font-semibold text-text-main">{readiness.label}</p>
          <p className="mt-0.5 text-sm leading-snug text-text-muted">
            {readinessInterpretation(readiness.overall)}
          </p>
        </div>
      </div>

      <div className="mt-3.5 space-y-2">
        {lowestCategories.map(({ key, label }) => (
          <div key={key}>
            <div className="mb-1 flex items-center justify-between gap-3 text-xs">
              <span className="font-medium text-text-main">{label}</span>
              <span className="min-w-9 text-right font-mono text-text-muted">
                {readiness[key]}%
              </span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-card-hover"
              role="progressbar"
              aria-label={`${label} readiness`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={readiness[key]}
            >
              <div
                className="h-full rounded-full bg-status-ready transition-[width] motion-reduce:transition-none"
                style={{ width: `${readiness[key]}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
