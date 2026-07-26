'use client';

import React from 'react';
import type { TripDashboard } from '@/types';
import CampsiteMapSelector, { type CampsiteSelection } from '@/components/maps/CampsiteMapSelector';

interface MapRouteCardInnerProps {
    trip: TripDashboard;
}

export default function MapRouteCardInner({ trip }: MapRouteCardInnerProps) {
    const selection: CampsiteSelection = {
        latitude: trip.campsite_latitude!,
        longitude: trip.campsite_longitude!,
        label: trip.campsite_label,
        source: trip.campsite_source === 'maptiler_geocoding_refined'
            ? 'maptiler_geocoding_refined'
            : 'manual_map_selection',
        osmId: trip.campsite_osm_id,
    };

    return (
        <CampsiteMapSelector
            value={selection}
            mapStyle={trip.map_style}
            showSearch={false}
            className="h-full w-full border-0 rounded-none"
        />
    );
}
