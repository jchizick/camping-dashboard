'use client';

import React, { useRef, useEffect } from 'react';
import * as maptilersdk from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';
import type { Trip } from '@/types';

interface MapRouteCardInnerProps {
    trip: Trip;
}

export default function MapRouteCardInner({ trip }: MapRouteCardInnerProps) {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<maptilersdk.Map | null>(null);

    const centerLng = trip.launch_lng && trip.site_lng
        ? (trip.launch_lng + trip.site_lng) / 2
        : -78.8381;
    const centerLat = trip.launch_lat && trip.site_lat
        ? (trip.launch_lat + trip.site_lat) / 2
        : 45.4685;

    maptilersdk.config.apiKey = process.env.NEXT_PUBLIC_MAPTILER_API_KEY!;

    useEffect(() => {
        if (map.current) return;

        map.current = new maptilersdk.Map({
            container: mapContainer.current!,
            style: '019d455e-b710-7fbb-9975-144fe567f9ec',
            center: [centerLng, centerLat],
            zoom: 12,
            navigationControl: false,
            geolocateControl: false,
            scaleControl: false,
            fullscreenControl: false,
            attributionControl: false,
        });

        return () => {
            map.current?.remove();
            map.current = null;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [centerLng, centerLat]);

    return (
        // map-wrap: position relative, explicit height so SDK can measure it
        <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: '0.5rem', overflow: 'hidden' }}>
            {/* map: position absolute so SDK fills the wrap */}
            <div
                ref={mapContainer}
                style={{ position: 'absolute', width: '100%', height: '100%' }}
            />
            <div className="absolute bottom-0 right-0 p-[2px] px-2 bg-white/90 dark:bg-black/90 backdrop-blur-md rounded-tl-lg text-[10px] border-t border-l border-white/20 z-10">
                <a
                    href="https://www.maptiler.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-600 dark:text-amber-500 hover:underline opacity-80 hover:opacity-100 transition-opacity"
                >
                    © MapTiler
                </a>
            </div>
        </div>
    );
}
