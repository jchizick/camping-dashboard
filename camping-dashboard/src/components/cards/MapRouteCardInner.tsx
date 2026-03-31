'use client';

import React from 'react';
import type { Trip } from '@/types';

interface MapRouteCardInnerProps {
    trip: Trip;
}

export default function MapRouteCardInner({ trip }: MapRouteCardInnerProps) {
    return (
        <div className="w-full h-full relative rounded-lg overflow-hidden flex flex-col">
            <iframe
                title="Route Map"
                className="w-full h-full border-0 absolute inset-0"
                src="https://api.maptiler.com/maps/019d455e-b710-7fbb-9975-144fe567f9ec/?key=zRQbzdzcvKZvVUFTa6z3#14.1/45.46847/-78.83810"
                allow="geolocation"
            />
            <div className="absolute bottom-0 right-0 p-[2px] px-2 bg-white/90 dark:bg-black/90 backdrop-blur-md rounded-tl-lg text-[10px] border-t border-l border-white/20 z-10">
                <a 
                    href="https://api.maptiler.com/maps/019d455e-b710-7fbb-9975-144fe567f9ec/?key=zRQbzdzcvKZvVUFTa6z3#14.1/45.46847/-78.83810"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-600 dark:text-amber-500 hover:underline opacity-80 hover:opacity-100 transition-opacity"
                >
                    View Larger Map
                </a>
            </div>
        </div>
    );
}
