'use client';

import React, { useEffect, useState } from 'react';
import type { Trip, WeatherCurrent, ReadinessScore, CountdownResult, ThemeMode } from '@/types';
import { padTwo } from '@/lib/helpers';
import { useAuth } from '@/lib/authContext';
import { Activity, User as UserIcon, Star, Wind, Sunset } from 'lucide-react';

interface HeroHeaderProps {
    trip: Trip;
    weather: WeatherCurrent;
    readiness: ReadinessScore;
    countdown: CountdownResult;
    themeMode: ThemeMode;
    onMissionBrief?: () => void;
}

export default function HeroHeader({
    trip,
    weather,
    readiness,
    countdown,
    themeMode,
    onMissionBrief,
}: HeroHeaderProps) {
    const [tick, setTick] = useState(0);
    const { user, isAuthorized, isLoading, signIn, signOut } = useAuth();

    // Force a re-render every second so parent can update countdown
    useEffect(() => {
        const id = setInterval(() => setTick((t) => t + 1), 1000);
        return () => clearInterval(id);
    }, []);



    return (
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
            <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-accent-yellow/10 text-accent-yellow px-3 py-1 rounded-full text-xs font-mono uppercase tracking-widest border border-accent-yellow/20">
                        <Activity size={14} />
                        Expedition Control
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            id="mission-brief-btn"
                            onClick={onMissionBrief}
                            className="text-xs font-mono px-3 py-1 rounded-full border transition-all flex items-center gap-1.5 text-text-main border-accent-yellow/40 bg-accent-yellow/10 hover:bg-accent-yellow/20 hover:border-accent-yellow/60 active:scale-95"
                        >
                            🎧 Mission Brief
                        </button>
                        
                        {!isLoading && (
                            <button 
                                onClick={user ? signOut : signIn}
                                className={`text-xs font-mono px-3 py-1 rounded-full border transition-colors flex items-center gap-1 ${
                                    isAuthorized ? 'text-accent-yellow border-accent-yellow/30 bg-accent-yellow/10 hover:bg-accent-yellow/20' : 
                                    user ? 'text-accent-red border-accent-red/30 bg-accent-red/10' :
                                    'text-text-muted hover:text-text-main border-border-subtle hover:bg-card-hover'
                                }`}
                                title={isAuthorized ? `Signed in as ${user?.email}` : user ? 'Not authorized' : 'Admin sign in'}
                            >
                                <UserIcon size={12} /> {isAuthorized ? 'Admin' : user ? 'Unauthorized' : 'Sign In'}
                            </button>
                        )}
                    </div>
                </div>
                
                <div>
                    <h2 className="text-accent-yellow text-sm font-mono uppercase tracking-widest mb-1">{trip.park_name}</h2>
                    <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-text-main mb-2">{trip.name}</h1>
                    <p className="text-text-muted text-lg flex items-center gap-2">
                        {trip.lake_name} <span className="w-1 h-1 rounded-full bg-border-subtle" /> {trip.site_name}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-sm font-mono text-text-muted bg-card-bg px-4 py-2 rounded-lg border border-border-subtle w-fit">
                    <div className="flex items-center gap-2 text-text-main">
                        <Star size={16} className="text-accent-yellow fill-accent-yellow shrink-0" />
                        <span className="text-lg font-bold">{Math.round(weather.temperature_c)}°C</span>
                        <span className="text-text-muted whitespace-nowrap">{weather.condition_label}</span>
                    </div>
                    <div className="hidden sm:block w-px h-4 bg-border-subtle" />
                    <div className="flex items-center gap-2 whitespace-nowrap">
                        <Wind size={14} className="shrink-0" /> {weather.wind_kph} km/h
                    </div>
                    <div className="hidden sm:block w-px h-4 bg-border-subtle" />
                    <div className="flex items-center gap-2 whitespace-nowrap">
                        <Sunset size={14} className="text-accent-blue shrink-0" /> Sunset {weather.sunset_time}
                    </div>
                </div>
            </div>

            <div className="text-left md:text-right mt-4 md:mt-0">
                <div className="text-xs font-mono text-text-muted uppercase tracking-widest mb-2">Trip Begins In</div>
                <div className="flex flex-wrap gap-3 sm:gap-4 font-mono justify-start md:justify-end">
                    {countdown.isPast ? (
                        <div className="text-2xl font-bold text-accent-yellow">Trip is underway 🛶</div>
                    ) : (
                        [
                            { value: padTwo(countdown.days), label: 'Days' },
                            { value: padTwo(countdown.hours), label: 'Hrs' },
                            { value: padTwo(countdown.minutes), label: 'Min' },
                            { value: padTwo(countdown.seconds), label: 'Sec' }
                        ].map((unit, i) => (
                            <div key={i} className="flex flex-col items-center">
                                <span className="text-4xl md:text-5xl font-bold text-text-main tracking-tighter">{unit.value}</span>
                                <span className="text-[10px] uppercase tracking-widest text-text-muted mt-1">{unit.label}</span>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </header>
    );
}
