'use client';

import Image from 'next/image';
import GuardedTripLink from './GuardedTripLink';
import { tripDestinationHref } from './tripNavigation';
import './workspaceAccount.css';

export default function WorkspaceBrand({ tripId, compact = false }: { tripId: string; compact?: boolean }) {
  return <GuardedTripLink href={tripDestinationHref(tripId, '')}
    aria-label="Field Protocol — current trip Overview" className="workspace-brand">
    <Image src="/logo.svg" alt="" width={30} height={30} />
    {!compact && <span>FIELD<br />PROTOCOL</span>}
  </GuardedTripLink>;
}
