// @vitest-environment jsdom

import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mapMocks = vi.hoisted(() => {
    const state = {
        mapHandlers: {} as Record<string, (event?: unknown) => void>,
        markerHandlers: {} as Record<string, () => void>,
        geocoderHandlers: {} as Record<string, (event?: unknown) => void>,
        markerPosition: { lng: -79.3, lat: 45.2 },
    };

    const mapInstance = {
        on: vi.fn((event: string, handler: (event?: unknown) => void) => {
            state.mapHandlers[event] = handler;
        }),
        off: vi.fn(),
        resize: vi.fn(),
        remove: vi.fn(),
        addControl: vi.fn(),
        removeControl: vi.fn(),
        hasControl: vi.fn(() => false),
    };

    const markerInstance = {
        setLngLat: vi.fn((coordinates: [number, number]) => {
            state.markerPosition = { lng: coordinates[0], lat: coordinates[1] };
            return markerInstance;
        }),
        setPopup: vi.fn(() => markerInstance),
        addTo: vi.fn(() => markerInstance),
        remove: vi.fn(),
        on: vi.fn((event: string, handler: () => void) => {
            state.markerHandlers[event] = handler;
        }),
        off: vi.fn(),
        getLngLat: vi.fn(() => state.markerPosition),
    };

    const geocoderInstance = {
        on: vi.fn((event: string, handler: (event?: unknown) => void) => {
            state.geocoderHandlers[event] = handler;
        }),
        off: vi.fn(),
    };

    const mapConstructor = vi.fn(function MapConstructor() {
        return mapInstance;
    });
    const markerConstructor = vi.fn(function MarkerConstructor() {
        return markerInstance;
    });
    const popupConstructor = vi.fn(function PopupConstructor() {
        return { setText: vi.fn().mockReturnThis() };
    });
    const geocoderConstructor = vi.fn(function GeocoderConstructor() {
        return geocoderInstance;
    });

    return {
        state,
        mapInstance,
        markerInstance,
        geocoderInstance,
        mapConstructor,
        markerConstructor,
        popupConstructor,
        geocoderConstructor,
    };
});

vi.mock('@maptiler/sdk', () => ({
    config: { apiKey: '' },
    Map: mapMocks.mapConstructor,
    Marker: mapMocks.markerConstructor,
    Popup: mapMocks.popupConstructor,
    MapStyle: {
        OPENSTREETMAP: {
            DEFAULT: {
                getExpandedStyleURL: () => 'https://api.maptiler.com/maps/openstreetmap/style.json',
            },
        },
        OUTDOOR: {
            DARK: {
                getExpandedStyleURL: () => 'https://api.maptiler.com/maps/outdoor-v2-dark/style.json',
            },
        },
    },
}));

vi.mock('@maptiler/geocoding-control/maptilersdk', () => ({
    GeocodingControl: mapMocks.geocoderConstructor,
}));

import CampsiteMapSelector from './CampsiteMapSelector';

class ResizeObserverMock {
    observe = vi.fn();
    disconnect = vi.fn();
}

describe('CampsiteMapSelector failure handling', () => {
    beforeEach(() => {
        process.env.NEXT_PUBLIC_MAPTILER_API_KEY = 'test-public-key';
        mapMocks.state.mapHandlers = {};
        mapMocks.state.markerHandlers = {};
        mapMocks.state.geocoderHandlers = {};
        mapMocks.state.markerPosition = { lng: -79.3, lat: 45.2 };
        vi.clearAllMocks();
        mapMocks.mapConstructor.mockImplementation(function MapConstructor() {
            return mapMocks.mapInstance;
        });
        mapMocks.geocoderConstructor.mockImplementation(function GeocoderConstructor() {
            return mapMocks.geocoderInstance;
        });
        vi.stubGlobal('ResizeObserver', ResizeObserverMock);
        vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
            callback(0);
            return 1;
        });
        vi.stubGlobal('cancelAnimationFrame', vi.fn());
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        cleanup();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('shows an actionable missing-public-key state without constructing a map', () => {
        delete process.env.NEXT_PUBLIC_MAPTILER_API_KEY;
        const onManualEntry = vi.fn();

        render(<CampsiteMapSelector value={null} onChange={vi.fn()} onManualEntry={onManualEntry} className="h-[430px]" />);

        expect(screen.getByText('Map unavailable')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Enter coordinates manually' }));
        expect(onManualEntry).toHaveBeenCalledTimes(1);
        expect(mapMocks.mapConstructor).not.toHaveBeenCalled();
    });

    it('shows an initialization failure when the map constructor throws', async () => {
        mapMocks.mapConstructor.mockImplementationOnce(function MapConstructor() {
            throw new Error('constructor failed');
        });

        render(<CampsiteMapSelector value={null} onChange={vi.fn()} className="h-[430px]" />);

        expect(await screen.findByText('Map unavailable')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Retry map' })).toBeTruthy();
    });

    it('removes the loading state only after the map load event succeeds', () => {
        render(<CampsiteMapSelector value={null} onChange={vi.fn()} className="h-[430px]" />);

        expect(screen.getByText('Loading campsite map…')).toBeTruthy();
        act(() => mapMocks.state.mapHandlers.load());

        expect(screen.queryByText('Loading campsite map…')).toBeNull();
        expect(mapMocks.mapInstance.resize).toHaveBeenCalled();
        expect(mapMocks.mapConstructor).toHaveBeenCalledWith(
            expect.objectContaining({
                style: 'https://api.maptiler.com/maps/openstreetmap/style.json',
            })
        );
    });

    it('turns a pre-load map error event into an actionable network failure', async () => {
        render(<CampsiteMapSelector value={null} onChange={vi.fn()} className="h-[430px]" />);

        act(() => mapMocks.state.mapHandlers.error({ error: new Error('tile request failed') }));

        expect(await screen.findByText('Map unavailable')).toBeTruthy();
        expect(screen.getByText(/enter the campsite coordinates manually/i)).toBeTruthy();
    });

    it('keeps click placement usable when geocoder construction fails', async () => {
        const onChange = vi.fn();
        mapMocks.geocoderConstructor.mockImplementationOnce(function GeocoderConstructor() {
            throw new Error('geocoder unavailable');
        });

        render(<CampsiteMapSelector value={null} onChange={onChange} className="h-[430px]" />);
        act(() => mapMocks.state.mapHandlers.load());

        expect(await screen.findByText('Search is unavailable. Click the map to place your campsite.')).toBeTruthy();

        act(() => mapMocks.state.mapHandlers.click({ lngLat: { lng: -78.84017, lat: 45.46836 } }));
        expect(onChange).toHaveBeenCalledWith({
            latitude: 45.46836,
            longitude: -78.84017,
            label: null,
            source: 'manual_map_selection',
            osmId: null,
        });
    });

    it('uses a committed geocoder pick as provenance for the next map refinement', () => {
        const onChange = vi.fn();

        render(<CampsiteMapSelector value={null} onChange={onChange} className="h-[430px]" />);
        act(() => mapMocks.state.mapHandlers.load());
        act(() => mapMocks.state.geocoderHandlers.pick({
            feature: {
                id: 'poi.123',
                place_name: 'Algonquin Provincial Park, Canada',
                properties: { osm_id: 456 },
            },
        }));
        act(() => mapMocks.state.mapHandlers.click({ lngLat: { lng: -78.7, lat: 45.5 } }));

        expect(onChange).toHaveBeenCalledWith({
            latitude: 45.5,
            longitude: -78.7,
            label: 'Algonquin Provincial Park, Canada',
            source: 'maptiler_geocoding_refined',
            osmId: '456',
        });
    });

    it('retries a recoverable constructor failure and can subsequently load', async () => {
        mapMocks.mapConstructor.mockImplementationOnce(function MapConstructor() {
            throw new Error('temporary constructor failure');
        });

        render(<CampsiteMapSelector value={null} onChange={vi.fn()} className="h-[430px]" />);

        const retry = await screen.findByRole('button', { name: 'Retry map' });
        fireEvent.click(retry);

        await waitFor(() => expect(mapMocks.mapConstructor).toHaveBeenCalledTimes(2));
        expect(screen.getByText('Loading campsite map…')).toBeTruthy();

        act(() => mapMocks.state.mapHandlers.load());
        expect(screen.queryByText('Loading campsite map…')).toBeNull();
        expect(screen.queryByText('Map unavailable')).toBeNull();
    });
});
