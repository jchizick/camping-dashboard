'use client';

import Image from 'next/image';
import { useState } from 'react';
import type { TripDashboard } from '@/types';
import { resolveTripWorkspaceBackground } from './tripWorkspaceVisuals';

interface TripWorkspaceBackgroundProps {
  trip?: Pick<TripDashboard, 'park_name' | 'lake_name'> | null;
}

export default function TripWorkspaceBackground({
  trip = null,
}: TripWorkspaceBackgroundProps) {
  const source = trip ? resolveTripWorkspaceBackground(trip) : null;
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const showImage = source !== null && failedSource !== source;

  return (
    <div
      className="trip-workspace-background"
      data-background-state={showImage ? 'image' : 'fallback'}
      aria-hidden="true"
    >
      {showImage ? (
        <Image
          src={source}
          alt=""
          fill
          priority
          sizes="100vw"
          className="trip-workspace-background__image"
          onError={() => setFailedSource(source)}
        />
      ) : null}
      <div className="trip-workspace-background__topography bg-topography" />
      <div className="trip-workspace-background__overlay" />
    </div>
  );
}
