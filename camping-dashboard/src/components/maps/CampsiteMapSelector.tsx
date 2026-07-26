'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as maptilersdk from '@maptiler/sdk';
import { GeocodingControl, type PickEvent } from '@maptiler/geocoding-control/maptilersdk';
import type { TripMapStyle } from '@/types';
import { AlertCircle, Loader2, MapPin, RefreshCw, Search } from 'lucide-react';

export interface CampsiteSelection {
    latitude: number;
    longitude: number;
    label: string | null;
    source: 'manual_map_selection' | 'maptiler_geocoding_refined';
    osmId: string | null;
}

interface CampsiteMapSelectorProps {
    value: CampsiteSelection | null;
    onChange?: (selection: CampsiteSelection) => void;
    mapStyle?: TripMapStyle | null;
    showSearch?: boolean;
    visible?: boolean;
    className?: string;
}

interface SearchMetadata {
    label: string | null;
    osmId: string | null;
}

type MapFailure = 'initialization' | 'network';

const DEFAULT_CENTER: [number, number] = [-79.3832, 44.25];
const MAP_LOAD_TIMEOUT_MS = 12_000;

function resolveStyle(style: TripMapStyle | null | undefined): string {
    return style === 'expedition'
        ? maptilersdk.MapStyle.OUTDOOR.DARK.getExpandedStyleURL()
        : maptilersdk.MapStyle.OPENSTREETMAP.DEFAULT.getExpandedStyleURL();
}

function createMarkerElement() {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = 'campsite-selected-marker';
    element.setAttribute('aria-label', 'Your campsite');
    element.title = 'Your campsite';
    element.innerHTML = '<span aria-hidden="true">▲</span>';
    return element;
}

function extractOsmId(event: PickEvent): string | null {
    const properties = event.feature?.properties as Record<string, unknown> | null | undefined;
    const candidate = properties?.osm_id ?? properties?.osmId;
    return typeof candidate === 'string' || typeof candidate === 'number'
        ? String(candidate)
        : null;
}

function logDevelopmentError(stage: string, error: unknown) {
    if (process.env.NODE_ENV !== 'production') {
        console.error(`[CampsiteMapSelector] ${stage}`, error);
    }
}

export default function CampsiteMapSelector({
    value,
    onChange,
    mapStyle = 'openstreetmap',
    showSearch = true,
    visible = true,
    className = '',
}: CampsiteMapSelectorProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maptilersdk.Map | null>(null);
    const markerRef = useRef<maptilersdk.Marker | null>(null);
    const valueRef = useRef(value);
    const onChangeRef = useRef(onChange);
    const searchMetadataRef = useRef<SearchMetadata | null>(null);
    const initialStyleRef = useRef(mapStyle);
    const initialSearchRef = useRef(showSearch);
    const [attempt, setAttempt] = useState(0);
    const [mapState, setMapState] = useState<'loading' | 'ready' | 'error'>('loading');
    const [mapFailure, setMapFailure] = useState<MapFailure | null>(null);
    const [geocoderUnavailable, setGeocoderUnavailable] = useState(false);
    const [networkWarning, setNetworkWarning] = useState(false);
    const [searching, setSearching] = useState(false);
    const apiKey = process.env.NEXT_PUBLIC_MAPTILER_API_KEY;
    const editable = Boolean(onChange);

    useEffect(() => {
        valueRef.current = value;
    }, [value]);

    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    useEffect(() => {
        const marker = markerRef.current;
        const map = mapRef.current;
        if (!marker || !map) return;
        if (!value) {
            marker.remove();
            return;
        }
        marker
            .setLngLat([value.longitude, value.latitude])
            .setPopup(new maptilersdk.Popup({ offset: 22 }).setText('Your campsite'))
            .addTo(map);
    }, [value]);

    useEffect(() => {
        if (!visible || !mapRef.current) return;
        const frame = requestAnimationFrame(() => mapRef.current?.resize());
        return () => cancelAnimationFrame(frame);
    }, [visible]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container || !apiKey) return;

        let disposed = false;
        let loaded = false;
        let map: maptilersdk.Map | null = null;
        let marker: maptilersdk.Marker | null = null;
        let geocoder: GeocodingControl | null = null;
        let handlePick: ((event: PickEvent) => void) | null = null;
        let handleRequest: (() => void) | null = null;
        let handleResponse: (() => void) | null = null;
        let loadTimeout: ReturnType<typeof setTimeout> | null = null;

        const failMap = (failure: MapFailure, error: unknown) => {
            if (disposed) return;
            logDevelopmentError(
                failure === 'initialization' ? 'Map initialization failed' : 'Map or tile loading failed',
                error
            );
            setMapFailure(failure);
            setMapState('error');
        };
        const failGeocoder = (error: unknown) => {
            if (disposed) return;
            logDevelopmentError('Geocoder initialization failed; map clicking remains available', error);
            setGeocoderUnavailable(true);
        };

        try {
            maptilersdk.config.apiKey = apiKey;
            const initialValue = valueRef.current;
            map = new maptilersdk.Map({
                container,
                style: resolveStyle(initialStyleRef.current),
                center: initialValue
                    ? [initialValue.longitude, initialValue.latitude]
                    : DEFAULT_CENTER,
                zoom: initialValue ? 14 : 5,
                navigationControl: true,
                geolocateControl: false,
                scaleControl: false,
                fullscreenControl: false,
                attributionControl: {},
            });
            mapRef.current = map;

            marker = new maptilersdk.Marker({
                element: createMarkerElement(),
                draggable: editable,
                anchor: 'bottom',
            });
            markerRef.current = marker;

            if (initialValue) {
                marker
                    .setLngLat([initialValue.longitude, initialValue.latitude])
                    .setPopup(new maptilersdk.Popup({ offset: 22 }).setText('Your campsite'))
                    .addTo(map);
            }

            const publishSelection = (longitude: number, latitude: number) => {
                if (!onChangeRef.current) return;
                const searchMetadata = searchMetadataRef.current;
                onChangeRef.current({
                    latitude,
                    longitude,
                    label: searchMetadata?.label ?? null,
                    source: searchMetadata
                        ? 'maptiler_geocoding_refined'
                        : 'manual_map_selection',
                    osmId: searchMetadata?.osmId ?? null,
                });
            };

            const placeMarker = (longitude: number, latitude: number) => {
                marker
                    ?.setLngLat([longitude, latitude])
                    .setPopup(new maptilersdk.Popup({ offset: 22 }).setText('Your campsite'))
                    .addTo(map!);
                publishSelection(longitude, latitude);
            };

            const handleMapClick = (event: maptilersdk.MapMouseEvent) => {
                if (!onChangeRef.current) return;
                placeMarker(event.lngLat.lng, event.lngLat.lat);
            };
            const handleDragEnd = () => {
                const position = marker?.getLngLat();
                if (position) publishSelection(position.lng, position.lat);
            };
            const handleLoad = () => {
                if (disposed) return;
                loaded = true;
                if (loadTimeout) clearTimeout(loadTimeout);
                setMapFailure(null);
                setMapState('ready');
                map?.resize();
            };
            const handleError = (event: maptilersdk.ErrorEvent) => {
                if (!loaded) {
                    failMap('network', event.error);
                    return;
                }
                logDevelopmentError('A map resource failed after load', event.error);
                setNetworkWarning(true);
            };

            map.on('click', handleMapClick);
            map.on('load', handleLoad);
            map.on('error', handleError);
            marker.on('dragend', handleDragEnd);

            loadTimeout = setTimeout(() => {
                if (!loaded) {
                    failMap('network', new Error('Map load timed out'));
                }
            }, MAP_LOAD_TIMEOUT_MS);

            if (initialSearchRef.current && onChangeRef.current) {
                try {
                    // v3 ships the geocoder UI styles inside its Lit components.
                    geocoder = new GeocodingControl({
                        marker: false,
                        showResultMarkers: false,
                        placeholder: 'Search park, lake, campground, or place',
                        flyTo: true,
                    });
                    handlePick = (event) => {
                        const feature = event.feature;
                        searchMetadataRef.current = feature
                            ? {
                                label: feature.place_name || feature.text || null,
                                osmId: extractOsmId(event),
                            }
                            : null;
                        setSearching(false);
                    };
                    handleRequest = () => setSearching(true);
                    handleResponse = () => setSearching(false);
                    // `select` tracks the highlighted list item and is cleared
                    // after a result is chosen. `pick` is the committed result.
                    geocoder.on('pick', handlePick);
                    geocoder.on('request', handleRequest);
                    geocoder.on('response', handleResponse);
                    map.addControl(geocoder, 'top-left');
                } catch (error) {
                    failGeocoder(error);
                }
            }

            const observer = new ResizeObserver(() => map?.resize());
            observer.observe(container);

            return () => {
                disposed = true;
                if (loadTimeout) clearTimeout(loadTimeout);
                observer.disconnect();
                map?.off('click', handleMapClick);
                map?.off('load', handleLoad);
                map?.off('error', handleError);
                marker?.off('dragend', handleDragEnd);
                marker?.remove();
                if (geocoder) {
                    if (handlePick) geocoder.off('pick', handlePick);
                    if (handleRequest) geocoder.off('request', handleRequest);
                    if (handleResponse) geocoder.off('response', handleResponse);
                    if (map?.hasControl(geocoder)) map.removeControl(geocoder);
                }
                map?.remove();
                markerRef.current = null;
                mapRef.current = null;
            };
        } catch (error) {
            failMap('initialization', error);
            map?.remove();
            mapRef.current = null;
            markerRef.current = null;
            return () => {
                disposed = true;
                if (loadTimeout) clearTimeout(loadTimeout);
            };
        }
    }, [apiKey, attempt, editable]);

    function handleRetry() {
        setMapState('loading');
        setMapFailure(null);
        setGeocoderUnavailable(false);
        setNetworkWarning(false);
        setSearching(false);
        setAttempt((current) => current + 1);
    }

    const missingKey = !apiKey;
    const showBlockingFailure = missingKey || mapState === 'error';

    return (
        <div className={`relative overflow-hidden rounded-xl border border-border-subtle bg-card-hover ${className}`}>
            <div
                ref={containerRef}
                className="absolute inset-0 h-full w-full"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                aria-label="Campsite location map"
            />

            {!missingKey && mapState === 'loading' && (
                <div className="absolute inset-0 z-20 flex items-center justify-center gap-2 bg-card-bg text-sm text-text-muted">
                    <Loader2 size={18} className="animate-spin" />
                    Loading campsite map…
                </div>
            )}

            {showBlockingFailure && (
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-card-bg px-6 text-center" role="alert">
                    <MapPin size={26} className="text-accent-red" />
                    <div>
                        <p className="text-sm font-semibold text-text-main">
                            {missingKey
                                ? 'The campsite map is not configured.'
                                : 'The campsite map could not load.'}
                        </p>
                        <p className="mt-1 text-xs text-text-muted">
                            {missingKey
                                ? 'Add NEXT_PUBLIC_MAPTILER_API_KEY and restart the development server.'
                                : mapFailure === 'network'
                                    ? 'Check the MapTiler network connection and try again.'
                                    : 'Check the MapTiler configuration and try again.'}
                        </p>
                    </div>
                    {!missingKey && (
                        <button
                            type="button"
                            onClick={handleRetry}
                            className="inline-flex items-center gap-2 rounded-lg border border-border-subtle bg-card-hover px-3 py-2 text-xs font-semibold text-text-main hover:border-accent-blue/50"
                        >
                            <RefreshCw size={14} />
                            Retry map
                        </button>
                    )}
                </div>
            )}

            {geocoderUnavailable && mapState === 'ready' && (
                <div className="absolute left-3 right-3 top-3 z-10 flex items-start gap-2 rounded-lg border border-accent-yellow/30 bg-card-bg/95 px-3 py-2 text-xs text-text-muted shadow-sm" role="status">
                    <AlertCircle size={14} className="mt-0.5 shrink-0 text-accent-yellow" />
                    <span>Search is unavailable. Click the map to place your campsite.</span>
                </div>
            )}

            {networkWarning && mapState === 'ready' && (
                <div className="absolute bottom-8 left-3 right-3 z-10 rounded-lg border border-accent-yellow/30 bg-card-bg/95 px-3 py-2 text-xs text-text-muted shadow-sm" role="status">
                    A map resource failed to load. You can still reposition the campsite or retry the page.
                </div>
            )}

            {searching && mapState === 'ready' && !geocoderUnavailable && (
                <div className="absolute right-3 top-3 z-10 flex items-center gap-2 rounded-lg border border-border-subtle bg-card-bg/95 px-3 py-2 text-xs text-text-muted shadow-sm">
                    <Search size={13} />
                    Searching…
                </div>
            )}
        </div>
    );
}
