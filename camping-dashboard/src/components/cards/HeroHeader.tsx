'use client';

import React, { useEffect, useState } from 'react';
import type { Trip, WeatherCurrent, ReadinessScore, CountdownResult, ThemeMode } from '@/types';
import { padTwo } from '@/lib/helpers';
import { useAuth } from '@/lib/authContext';


interface HeroHeaderProps {
    trip: Trip;
    weather: WeatherCurrent;
    readiness: ReadinessScore;
    countdown: CountdownResult;
    themeMode: ThemeMode;
    themeOverride: 'auto' | 'day' | 'night';
    onThemeToggle: () => void;
}

export default function HeroHeader({
    trip,
    weather,
    readiness,
    countdown,
    themeMode,
    themeOverride,
    onThemeToggle,
}: HeroHeaderProps) {
    const [tick, setTick] = useState(0);
    const { user, isAuthorized, isLoading, signIn, signOut } = useAuth();

    // Force a re-render every second so parent can update countdown
    useEffect(() => {
        const id = setInterval(() => setTick((t) => t + 1), 1000);
        return () => clearInterval(id);
    }, []);

    return (
        <header className="hero">
            <div className="hero__bg-overlay" />

            <div className="hero__top-bar">
                <div className="hero__badge">
                    <span className="hero__badge-dot" />
                    EXPEDITION CONTROL
                </div>
                <button
                    className="hero__theme-toggle"
                    onClick={onThemeToggle}
                    aria-label="Toggle day/night theme"
                >
                    {themeOverride === 'auto' ? '⟳ Auto' : themeMode === 'day' ? '☀️ Day' : '🌙 Night'}
                </button>

                {/* ── Admin auth button ── */}
                {!isLoading && (
                    isAuthorized ? (
                        <button
                            className="hero__admin-btn hero__admin-btn--signed-in"
                            onClick={signOut}
                            title={`Signed in as ${user?.email}\nClick to sign out`}
                            aria-label="Sign out"
                        >
                            <span className="hero__admin-avatar">
                                {(user?.email?.[0] ?? 'A').toUpperCase()}
                            </span>
                            <span className="hero__admin-label">Admin</span>
                        </button>
                    ) : user ? (
                        // Signed in but not on whitelist
                        <button
                            className="hero__admin-btn hero__admin-btn--unauthorized"
                            onClick={signOut}
                            title="Not authorized — click to sign out"
                            aria-label="Sign out"
                        >
                            🚫 Unauthorized
                        </button>
                    ) : (
                        <button
                            className="hero__admin-btn hero__admin-btn--sign-in"
                            onClick={signIn}
                            aria-label="Admin sign in"
                            title="Sign in to edit dashboard data"
                        >
                            🔑 Admin
                        </button>
                    )
                )}
            </div>

            <div className="hero__center">
                <div className="hero__title-block">
                    <p className="hero__park">{trip.park_name}</p>
                    <h1 className="hero__title">{trip.name}</h1>
                    <p className="hero__subtitle">{trip.lake_name} · {trip.site_name}</p>
                </div>

                <div className="hero__countdown" aria-live="polite" aria-atomic="true">
                    {countdown.isPast ? (
                        <div className="hero__countdown-past">Trip is underway 🛶</div>
                    ) : (
                        <>
                            <p className="hero__countdown-label">Trip begins in</p>
                            <div className="hero__countdown-units">
                                <div className="hero__countdown-unit">
                                    <span className="hero__countdown-value">{padTwo(countdown.days)}</span>
                                    <span className="hero__countdown-unit-label">days</span>
                                </div>
                                <span className="hero__countdown-sep">:</span>
                                <div className="hero__countdown-unit">
                                    <span className="hero__countdown-value">{padTwo(countdown.hours)}</span>
                                    <span className="hero__countdown-unit-label">hrs</span>
                                </div>
                                <span className="hero__countdown-sep">:</span>
                                <div className="hero__countdown-unit">
                                    <span className="hero__countdown-value">{padTwo(countdown.minutes)}</span>
                                    <span className="hero__countdown-unit-label">min</span>
                                </div>
                                <span className="hero__countdown-sep">:</span>
                                <div className="hero__countdown-unit">
                                    <span className="hero__countdown-value">{padTwo(countdown.seconds)}</span>
                                    <span className="hero__countdown-unit-label">sec</span>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="hero__footer">
                <div className="hero__conditions">
                    <span className="hero__conditions-icon">{weather.icon}</span>
                    <span className="hero__conditions-temp">{Math.round(weather.temperature_c)}°C</span>
                    <span className="hero__conditions-label">{weather.condition_label}</span>
                    <span className="hero__conditions-divider">·</span>
                    <span className="hero__conditions-wind">💨 {weather.wind_kph} km/h</span>
                    <span className="hero__conditions-divider">·</span>
                    <span className="hero__conditions-sunset">🌅 Sunset {weather.sunset_time}</span>
                </div>
            </div>
        </header>
    );
}
