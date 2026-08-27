import type { CSSProperties } from 'react';
import GuardedTripLink from '@/components/trip/GuardedTripLink';
import type {
  ReadinessCategoryAvailability,
  ReadinessResult,
  ReadinessStatus,
} from '@/lib/readiness';
import { Card } from '@/components/ui/Primitives';
import { Activity, ChevronRight } from 'lucide-react';

const READINESS_CATEGORIES = [
  { key: 'gear' as const, label: 'Gear' },
  { key: 'meals' as const, label: 'Meals' },
  { key: 'offline' as const, label: 'Manual Prep' },
  { key: 'weather' as const, label: 'Conditions' },
  { key: 'timeline' as const, label: 'Timeline' },
];

function readinessInterpretation(status: ReadinessStatus) {
  if (status === 'locked-in') return 'Core trip preparations are in strong shape.';
  if (status === 'nearly-ready') return 'A few preparation gaps still need attention.';
  if (status === 'unavailable') return 'Add preparation details to calculate readiness.';
  return 'Resolve the lowest readiness areas before departure.';
}

function availabilityLabel(availability: ReadinessCategoryAvailability) {
  if (availability === 'informational') return 'Info';
  if (availability === 'excluded') return 'N/A';
  return 'Unavailable';
}

export default function ReadinessSummaryCard({
  readiness,
  href,
}: {
  readiness: ReadinessResult;
  href: string;
}) {
  const lowestCategories = READINESS_CATEGORIES
    .filter(({ key }) => readiness.categories[key].availability !== 'excluded')
    .toSorted((left, right) => {
      const leftScore = readiness.categories[left.key].score;
      const rightScore = readiness.categories[right.key].score;
      if (leftScore === null && rightScore === null) return 0;
      if (leftScore === null) return 1;
      if (rightScore === null) return -1;
      return leftScore - rightScore;
    })
    .slice(0, 3);
  const overallScore = readiness.score;

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
          aria-valuenow={overallScore ?? undefined}
          aria-valuetext={
            overallScore === null
              ? readiness.statusLabel
              : `${overallScore}% · ${readiness.statusLabel}`
          }
          style={{ '--readiness-value': overallScore ?? 0 } as CSSProperties}
        >
          <span className="text-2xl font-bold text-text-main">
            {overallScore === null ? '—' : `${overallScore}%`}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-base font-semibold text-text-main">{readiness.statusLabel}</p>
          <p className="mt-0.5 text-sm leading-snug text-text-muted">
            {readinessInterpretation(readiness.status)}
          </p>
        </div>
      </div>

      <div className="mt-3.5 space-y-2">
        {lowestCategories.map(({ key, label }) => {
          const category = readiness.categories[key];
          return (
          <div key={key}>
            <div className="mb-1 flex items-center justify-between gap-3 text-xs">
              <span className="font-medium text-text-main">{label}</span>
              <span className="min-w-9 text-right font-mono text-text-muted">
                {category.score === null
                  ? availabilityLabel(category.availability)
                  : `${category.score}%`}
              </span>
            </div>
            {category.score === null ? (
              <div className="h-2 rounded-full bg-card-hover" aria-hidden="true" />
            ) : (
              <div
                className="h-2 overflow-hidden rounded-full bg-card-hover"
                role="progressbar"
                aria-label={`${label} readiness`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={category.score}
              >
                <div
                  className="h-full rounded-full bg-status-ready transition-[width] motion-reduce:transition-none"
                  style={{ width: `${category.score}%` }}
                />
              </div>
            )}
          </div>
        )})}
      </div>
    </Card>
  );
}
