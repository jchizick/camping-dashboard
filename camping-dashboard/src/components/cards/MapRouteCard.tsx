'use client';

import React, { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import type { TripDashboard } from '@/types';
import type { CampsiteSelection } from '@/components/maps/CampsiteMapSelector';
import { Card } from '@/components/ui/Primitives';
import { Map, MapPin, Pencil } from 'lucide-react';

interface MapRouteCardProps {
    trip: TripDashboard;
    onSaveLocation?: (selection: CampsiteSelection) => Promise<void>;
    variant?: 'default' | 'home';
}

const MapInner = dynamic(() => import('./MapRouteCardInner'), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full flex items-center justify-center text-text-muted text-sm">
            Loading map…
        </div>
    ),
});

const CampsiteLocationSheet = dynamic(
    () => import('@/components/maps/CampsiteLocationSheet'),
    { ssr: false }
);

function hasCoordinates(trip: TripDashboard) {
    return typeof trip.campsite_latitude === 'number'
        && Number.isFinite(trip.campsite_latitude)
        && typeof trip.campsite_longitude === 'number'
        && Number.isFinite(trip.campsite_longitude);
}

export default function MapRouteCard({
    trip,
    onSaveLocation,
    variant = 'default',
}: MapRouteCardProps) {
    const [sheetOpen, setSheetOpen] = useState(false);
    const hasLocation = hasCoordinates(trip);
    const isProvisional = trip.campsite_source === 'legacy_site_coordinates_unverified';
    const campsiteIdentity =
        [trip.park_name, trip.lake_name, trip.site_name].filter(Boolean).join(' · ')
        || 'Trip campsite';

    const initialSelection = useMemo<CampsiteSelection | null>(() => {
        if (!hasLocation) return null;
        return {
            latitude: trip.campsite_latitude!,
            longitude: trip.campsite_longitude!,
            label: trip.campsite_label,
            source: trip.campsite_source === 'maptiler_geocoding_refined'
                ? 'maptiler_geocoding_refined'
                : 'manual_map_selection',
            osmId: trip.campsite_osm_id,
        };
    }, [hasLocation, trip]);

    const action = (
        <div className="flex items-center gap-2">
            {onSaveLocation && (
                <button
                    type="button"
                    onClick={() => setSheetOpen(true)}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border-subtle bg-card-bg px-3 py-1 text-xs font-medium text-text-muted transition-colors hover:bg-card-hover hover:text-text-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                    {hasLocation ? <Pencil size={12} /> : <MapPin size={12} />}
                    {hasLocation ? 'Reposition' : 'Set location'}
                </button>
            )}
            {typeof trip.distance_km === 'number' && Number.isFinite(trip.distance_km) && (
                <span className="text-xs font-mono text-text-muted">{trip.distance_km} km</span>
            )}
        </div>
    );

    return (
        <>
            <Card
                title={
                    variant === 'home' ? (
                        <span className="home-map-card__heading">
                            <span>Campsite location</span>
                            <span className="home-map-card__subtitle">{campsiteIdentity}</span>
                        </span>
                    ) : (
                        'Map / Route'
                    )
                }
                icon={Map}
                className={variant === 'home' ? 'home-map-card h-full' : 'h-full'}
                action={action}
            >
                <div className={`text-sm text-text-muted ${variant === 'home' ? 'home-map-card__location mb-3' : 'mb-4'} font-mono`}>
                    {campsiteIdentity}
                </div>

                {isProvisional && (
                    <div className="home-map-card__provisional mb-3 rounded-lg border border-accent-yellow/30 bg-accent-yellow/10 px-3 py-2 text-xs text-accent-yellow">
                        Imported legacy coordinates — owner/editor verification recommended.
                    </div>
                )}

                <div
                    className={`home-map-card__canvas relative w-full overflow-hidden rounded-xl border border-border-subtle bg-card-hover ${
                        variant === 'home'
                            ? 'h-[350px] min-h-[350px] md:h-[390px] md:min-h-[390px]'
                            : 'h-[280px] min-h-[280px] md:h-[calc(100%-3rem)]'
                    }`}
                    role="region"
                    aria-label="Campsite map"
                >
                    {hasLocation ? (
                        <MapInner trip={trip} />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-3 px-6 text-center">
                            <MapPin size={28} className="text-text-muted" />
                            <div>
                                <p className="text-sm font-semibold text-text-main">Campsite location unavailable</p>
                                <p className="mt-1 text-xs text-text-muted">
                                    {onSaveLocation
                                        ? 'Set this trip’s campsite to show it on the map.'
                                        : 'An owner or editor has not set this trip’s campsite yet.'}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </Card>

            {onSaveLocation && (
                <CampsiteLocationSheet
                    isOpen={sheetOpen}
                    initialValue={initialSelection}
                    mapStyle={trip.map_style}
                    isProvisional={isProvisional}
                    onClose={() => setSheetOpen(false)}
                    onSave={onSaveLocation}
                />
            )}
        </>
    );
}
