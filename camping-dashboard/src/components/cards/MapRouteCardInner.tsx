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
                src="https://www.openstreetmap.org/export/embed.html?bbox=-78.84889841079713%2C45.46381789654231%2C-78.82853507995607%2C45.47317793516492&amp;layer=mapnik"
            />
            <div className="absolute bottom-0 right-0 p-[2px] px-2 bg-white/90 dark:bg-black/90 backdrop-blur-md rounded-tl-lg text-[10px] border-t border-l border-white/20 z-10">
                <a 
                    href="https://www.openstreetmap.org/?#map=16/45.46835/-78.83761"
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
