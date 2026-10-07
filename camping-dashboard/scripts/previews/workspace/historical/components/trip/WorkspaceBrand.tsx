'use client';

import Image from 'next/image';
import { GuardedTripLink } from '../../../adapters/framework';
import { tripDestinationHref } from './tripNavigation';

export default function WorkspaceBrand({ tripId, compact = false }: { tripId: string; compact?: boolean }) {
  return <GuardedTripLink href={tripDestinationHref(tripId, '')}
    aria-label="Field Protocol — current trip Overview" className="workspace-brand">
    <Image src="/logo.svg" alt="" width={30} height={30} />
    {!compact && <span>FIELD<br />PROTOCOL</span>}
  </GuardedTripLink>;
}
