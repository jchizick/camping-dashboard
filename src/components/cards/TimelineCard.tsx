'use client';

import React, { useState } from 'react';
import type { TimelineEvent } from '@/types';
import { groupBy } from '@/lib/helpers';
import GlassCard from '@/components/ui/GlassCard';
import SectionHeader from '@/components/ui/SectionHeader';

interface TimelineCardProps {
    events: TimelineEvent[];
    tripDays: number;
}

const dayLabels: Record<number, string> = {
    1: 'Day 1 — Arrival',
    2: 'Day 2 — Explore',
    3: 'Day 3 — Weather Watch',
    4: 'Day 4 — Paddle Out',
};

export default function TimelineCard({ events, tripDays }: TimelineCardProps) {
    const [selectedDay, setSelectedDay] = useState<number>(1);
    const grouped = groupBy(events, (e) => String(e.day_number));
    const dayEvents = (grouped[String(selectedDay)] || []).sort((a, b) => a.sort_order - b.sort_order);

    return (
        <GlassCard className="timeline-card">
            <SectionHeader title="Trip Timeline" icon="📋" subtitle={`${tripDays}-day expedition plan`} />

            <div className="timeline-card__day-tabs">
                {Array.from({ length: tripDays }, (_, i) => i + 1).map((day) => (
                    <button
                        key={day}
                        className={`timeline-card__day-tab ${selectedDay === day ? 'timeline-card__day-tab--active' : ''}`}
                        onClick={() => setSelectedDay(day)}
                        aria-pressed={selectedDay === day}
                    >
                        Day {day}
                    </button>
                ))}
            </div>

            <p className="timeline-card__day-label">
                {dayLabels[selectedDay] || `Day ${selectedDay}`}
            </p>

            <div className="timeline-card__events">
                {dayEvents.length === 0 ? (
                    <p className="timeline-card__empty">No events planned for this day yet</p>
                ) : (
                    dayEvents.map((event, i) => (
                        <div key={event.id} className="timeline-card__event">
                            <div className="timeline-card__event-time">{event.event_time}</div>
                            <div className="timeline-card__event-line">
                                <div className="timeline-card__event-dot" />
                                {i < dayEvents.length - 1 && <div className="timeline-card__event-connector" />}
                            </div>
                            <div className="timeline-card__event-content">
                                <p className="timeline-card__event-title">{event.title}</p>
                                {event.details && (
                                    <p className="timeline-card__event-details">{event.details}</p>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </GlassCard>
    );
}
