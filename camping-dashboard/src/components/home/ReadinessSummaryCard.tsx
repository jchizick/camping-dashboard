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
      className="h-full"
      action={
        <GuardedTripLink
          href={href}
          className="inline-flex items-center gap-1 rounded text-xs font-medium text-accent-yellow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          aria-label="View detailed gear readiness"
        >
          Details <ChevronRight size={14} aria-hidden="true" />
        </GuardedTripLink>
      }
    >
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-4xl font-bold tracking-tight text-text-main">
            {readiness.overall}%
          </p>
          <p className="mt-1 text-sm font-medium text-text-muted">{readiness.label}</p>
        </div>
        <div
          className="h-2 min-w-24 flex-1 overflow-hidden rounded-full bg-border-subtle"
          role="progressbar"
          aria-label="Overall trip readiness"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={readiness.overall}
        >
          <div
            className="h-full rounded-full bg-accent-yellow transition-[width] motion-reduce:transition-none"
            style={{ width: `${readiness.overall}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {lowestCategories.map(({ key, label }) => (
          <div key={key} className="rounded-lg bg-card-hover px-2.5 py-2 text-center">
            <p className="text-[10px] font-mono uppercase tracking-wide text-text-muted">
              {label}
            </p>
            <p className="mt-1 text-sm font-semibold text-text-main">{readiness[key]}%</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
