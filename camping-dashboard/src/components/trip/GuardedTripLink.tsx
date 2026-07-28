'use client';

import React from 'react';
import Link from 'next/link';
import { useOptionalTripDraftGuard } from './TripDraftGuardProvider';

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

    if (draftGuard) {
      event.preventDefault();
      draftGuard.requestNavigation(href);
    }
  }

  return <Link {...props} href={href} target={target} onClick={handleClick} />;
}
