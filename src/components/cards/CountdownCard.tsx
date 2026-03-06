'use client';

import React, { useEffect, useState } from 'react';
import type { Trip } from '@/types';
import type { CountdownResult } from '@/types';
import { getTripCountdown, padTwo } from '@/lib/helpers';
import GlassCard from '@/components/ui/GlassCard';
import SectionHeader from '@/components/ui/SectionHeader';

interface CountdownCardProps {
    trip: Trip;
}

export default function CountdownCard({ trip }: CountdownCardProps) {
    const [countdown, setCountdown] = useState<CountdownResult>(() =>
        getTripCountdown(trip.start_date)
    );

    useEffect(() => {
        const id = setInterval(() => {
            setCountdown(getTripCountdown(trip.start_date));
        }, 1000);
        return () => clearInterval(id);
    }, [trip.start_date]);

    return (
        <GlassCard className="countdown-card">
            <SectionHeader title="Departure" icon="⏱" />
            {countdown.isPast ? (
                <div className="countdown-card__past">
                    <span className="countdown-card__past-icon">🛶</span>
                    <p>Trip is underway</p>
                </div>
            ) : (
                <div
                    className="countdown-card__grid"
                    aria-live="polite"
                    aria-atomic="true"
                    aria-label={`${countdown.days} days, ${countdown.hours} hours, ${countdown.minutes} minutes, ${countdown.seconds} seconds until trip`}
                >
                    {[
                        { label: 'Days', value: countdown.days },
                        { label: 'Hours', value: countdown.hours },
                        { label: 'Min', value: countdown.minutes },
                        { label: 'Sec', value: countdown.seconds },
                    ].map(({ label, value }) => (
                        <div key={label} className="countdown-card__unit">
                            <span className="countdown-card__value">{padTwo(value)}</span>
                            <span className="countdown-card__label">{label}</span>
                        </div>
                    ))}
                </div>
            )}
            <p className="countdown-card__date">
                {new Date(trip.start_date + 'T12:00:00').toLocaleDateString('en-CA', {
                    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
                })}
            </p>
        </GlassCard>
    );
}
