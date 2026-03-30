'use client';

import React, { useEffect } from 'react';
import type { Trip } from '@/types';
import { Card } from '@/components/ui/Primitives';
import { Map } from 'lucide-react';

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
        <Card title="Route" icon={Map} className="h-full" action={<span className="text-xs font-mono text-text-muted">{trip.distance_km} km</span>}>
            <div className="text-sm text-text-muted mb-4 font-mono">
                {trip.launch_point_name} → {trip.lake_name} {trip.site_name}
            </div>
            <div className="relative w-full h-[240px] md:h-[calc(100%-3rem)] min-h-[240px] rounded-xl overflow-hidden border border-border-subtle bg-card-hover group">
                <div className="absolute inset-0 bg-map-overlay mix-blend-overlay pointer-events-none z-[1000]" />
                {ready && MapInner ? (
                    <MapInner trip={trip} />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-text-muted font-mono text-sm opacity-50">
                        <span className="text-3xl mb-2">🛶</span>
                        <p>Loading map…</p>
                    </div>
                )}
            </div>
        </Card>
    );
}
