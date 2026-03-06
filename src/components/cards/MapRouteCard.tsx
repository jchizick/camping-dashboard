'use client';

import React, { useEffect, useRef } from 'react';
import type { Trip } from '@/types';
import GlassCard from '@/components/ui/GlassCard';
import SectionHeader from '@/components/ui/SectionHeader';

interface MapRouteCardProps {
    trip: Trip;
}

// Dynamically loaded Leaflet map to avoid SSR issues
let MapInner: React.ComponentType<{ trip: Trip }> | null = null;

export default function MapRouteCard({ trip }: MapRouteCardProps) {
    const [ready, setReady] = React.useState(false);

    useEffect(() => {
        // Only load Leaflet on the client
        import('./MapRouteCardInner').then((mod) => {
            MapInner = mod.default;
            setReady(true);
        });
    }, []);

    return (
        <GlassCard className="map-route-card">
            <SectionHeader title="Route" icon="🗺" subtitle={`${trip.launch_point_name} → ${trip.lake_name} ${trip.site_name} · ${trip.distance_km} km`} />
            <div className="map-route-card__map-container">
                {ready && MapInner ? (
                    <MapInner trip={trip} />
                ) : (
                    <div className="map-route-card__placeholder">
                        <div className="map-route-card__placeholder-inner">
                            <span className="map-route-card__placeholder-icon">🛶</span>
                            <p>Loading map…</p>
                            <p className="map-route-card__placeholder-coords">
                                Launch: {trip.launch_lat.toFixed(4)}, {trip.launch_lng.toFixed(4)}<br />
                                Site 4: {trip.site_lat.toFixed(4)}, {trip.site_lng.toFixed(4)}
                            </p>
                        </div>
                    </div>
                )}
            </div>
            <div className="map-route-card__legend">
                <span className="map-route-card__legend-item">
                    <span className="map-route-card__legend-dot map-route-card__legend-dot--launch" />
                    {trip.launch_point_name}
                </span>
                <span className="map-route-card__legend-item">
                    <span className="map-route-card__legend-dot map-route-card__legend-dot--site" />
                    {trip.lake_name} — {trip.site_name}
                </span>
                <span className="map-route-card__legend-distance">📏 {trip.distance_km} km</span>
            </div>
        </GlassCard>
    );
}
