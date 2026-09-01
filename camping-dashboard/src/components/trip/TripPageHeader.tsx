import React from 'react';

export function TripSectionPage({
  route,
  children,
}: {
  route: 'plan' | 'gear' | 'crew' | 'guide' | 'field-log';
  children: React.ReactNode;
}) {
  return (
    <div
      className="trip-section-page relative z-10 mx-auto max-w-[1600px] space-y-6 p-4 md:p-6 lg:p-8"
      data-trip-section={route}
    >
      {children}
    </div>
  );
}

export default function TripPageHeader({
  title,
  description,
  distressed = false,
}: {
  title: string;
  description?: string;
  distressed?: boolean;
}) {
  return (
    <header className="trip-section-header space-y-1">
      <h1
        tabIndex={-1}
        data-mobile-type-role="page-title"
        className={`scroll-mt-20 text-3xl font-bold tracking-tight text-text-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring md:text-4xl${distressed ? ' display-distressed display-distressed--light' : ''}`}
      >
        {title}
      </h1>
      {description && <p className="text-sm text-text-muted">{description}</p>}
    </header>
  );
}

export function TripSectionEmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="trip-section-empty-state rounded-xl border border-dashed px-6 py-12 text-center text-sm"
      role="status"
    >
      {children}
    </div>
  );
}
