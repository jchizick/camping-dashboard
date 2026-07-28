import React from 'react';

export default function TripPageHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <header className="space-y-1">
      <h1
        tabIndex={-1}
        className="scroll-mt-20 text-3xl font-bold tracking-tight text-text-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring md:text-4xl"
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
      className="rounded-xl border border-dashed border-border-subtle bg-card-bg/60 px-6 py-12 text-center text-sm text-text-muted"
      role="status"
    >
      {children}
    </div>
  );
}
