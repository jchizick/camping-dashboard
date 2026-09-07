'use client';

import React from 'react';
import Link from 'next/link';
import { useOptionalTripDraftGuard } from './TripDraftGuardProvider';
import { useOptionalTripWorkspaceStatus } from './TripWorkspaceStatus';
import { desktopSectionHeading } from './desktopSectionNavigation';

type GuardedTripLinkProps = Omit<
  React.ComponentProps<typeof Link>,
  'href' | 'onClick'
> & {
  href: string;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
};

export default function GuardedTripLink({
  href,
  onClick,
  target,
  ...props
}: GuardedTripLinkProps) {
  const draftGuard = useOptionalTripDraftGuard();
  const workspace = useOptionalTripWorkspaceStatus();

  function handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      target === '_blank'
    ) {
      return;
    }

    if (workspace?.source === 'cache') {
      event.preventDefault();
      window.location.assign(href);
    } else if (href === `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      // Re-selecting the active section must work after manual document scrolling.
      // No history entry or query change is needed; retain the same draft guard.
      const documentRoot = document.querySelector<HTMLElement>('[data-desktop-trip-workspace] [data-desktop-workspace-document]');
      const tripId = documentRoot?.dataset.workspaceTripId;
      const headingId = tripId ? desktopSectionHeading(href, tripId) : null;
      const heading = headingId ? documentRoot?.querySelector<HTMLElement>(`#${headingId}`) : null;
      if (heading) {
        event.preventDefault();
        const focusSection = () => {
          window.requestAnimationFrame(() => {
            if (document.querySelector('[aria-modal="true"]')) return;
            heading.focus({ preventScroll: true });
            heading.scrollIntoView({ block: 'start', behavior: 'auto' });
          });
        };
        if (draftGuard) void draftGuard.requestAction(focusSection);
        else focusSection();
      } else if (draftGuard) {
        event.preventDefault();
        draftGuard.requestNavigation(href);
      }
    } else if (draftGuard) {
      event.preventDefault();
      draftGuard.requestNavigation(href);
    }
  }

  return (
    <Link
      {...props}
      href={href}
      target={target}
      prefetch={workspace?.source === 'cache' ? false : props.prefetch}
      onClick={handleClick}
    />
  );
}
