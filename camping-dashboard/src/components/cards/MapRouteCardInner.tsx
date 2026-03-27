'use client';

import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Trip } from '@/types';

// Fix Leaflet's default icon broken on webpack/Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const launchIcon = L.divIcon({
    className: '',
    html: `<div style="
    background: #C9A455;
    width: 14px; height: 14px;
    border-radius: 50%;
    border: 3px solid #fff;
    box-shadow: 0 2px 8px rgba(0,0,0,0.5);
  "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
});

const siteIcon = L.divIcon({
    className: '',
    html: `<div style="
    background: #4CAF95;
    width: 14px; height: 14px;
    border-radius: 50%;
    border: 3px solid #fff;
    box-shadow: 0 2px 8px rgba(0,0,0,0.5);
  "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
});

interface FitBoundsProps {
    positions: [number, number][];
}

function FitBounds({ positions }: FitBoundsProps) {
    const map = useMap();
    useEffect(() => {
        if (positions.length >= 2) {
            const bounds = L.latLngBounds(positions.map(([lat, lng]) => L.latLng(lat, lng)));
            map.fitBounds(bounds, { padding: [40, 40] });
        }
    }, [map, positions]);
    return null;
}

interface MapRouteCardInnerProps {
    trip: Trip;
}

export default function MapRouteCardInner({ trip }: MapRouteCardInnerProps) {
    const launch: [number, number] = [trip.launch_lat, trip.launch_lng];
    const site: [number, number] = [trip.site_lat, trip.site_lng];
    const route: [number, number][] = [launch, site];

    return (
        <MapContainer
            center={launch}
            zoom={11}
            style={{ height: '100%', width: '100%', borderRadius: '10px', background: 'transparent' }}
            zoomControl={false}
            attributionControl={false}
        >
            <TileLayer
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                opacity={0.85}
            />
            <FitBounds positions={route} />
            <Marker position={launch} icon={launchIcon}>
                <Popup>
                    <strong>{trip.launch_point_name}</strong><br />Launch point
                </Popup>
            </Marker>
            <Marker position={site} icon={siteIcon}>
                <Popup>
                    <strong>{trip.lake_name} — {trip.site_name}</strong><br />Campsite
                </Popup>
            </Marker>
            <Polyline positions={route} color="#C9A455" weight={2.5} dashArray="6 4" />
        </MapContainer>
    );
}
