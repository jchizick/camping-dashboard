'use client';

import React, { useState } from 'react';
import type { TimelineEvent } from '@/types';
import { groupBy } from '@/lib/helpers';
import GlassCard from '@/components/ui/GlassCard';
import SectionHeader from '@/components/ui/SectionHeader';
import TimelineFormSheet from '@/components/cards/TimelineFormSheet';

interface TimelineCardProps {
    events: TimelineEvent[];
    tripDays: number;
    onAdd?: (event: Omit<TimelineEvent, 'id' | 'trip_id'>) => Promise<void>;
    onUpdate?: (id: string, patch: Partial<Omit<TimelineEvent, 'id' | 'trip_id'>>) => Promise<void>;
    onDelete?: (id: string) => Promise<void>;
}

const dayLabels: Record<number, string> = {
    1: 'Day 1 — Arrival',
    2: 'Day 2 — Explore',
    3: 'Day 3 — Weather Watch',
    4: 'Day 4 — Paddle Out',
};

export default function TimelineCard({ events, tripDays, onAdd, onUpdate, onDelete }: TimelineCardProps) {
    const [selectedDay, setSelectedDay] = useState<number>(1);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState<TimelineEvent | undefined>(undefined);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

    const grouped = groupBy(events, (e) => String(e.day_number));
    const dayEvents = (grouped[String(selectedDay)] || []).sort((a, b) => a.sort_order - b.sort_order);

    // Auto-compute next sort order so new events land at the end
    const nextSortOrder = dayEvents.length > 0
        ? Math.max(...dayEvents.map((e) => e.sort_order)) + 10
        : 10;

    function openAdd() {
        setEditingEvent(undefined);
        setSheetOpen(true);
    }

    function openEdit(event: TimelineEvent) {
        setEditingEvent(event);
        setSheetOpen(true);
    }

    async function handleFormSubmit(data: Omit<TimelineEvent, 'id' | 'trip_id'>) {
        if (editingEvent) {
            await onUpdate?.(editingEvent.id, data);
        } else {
            await onAdd?.(data);
        }
    }

    function handleDelete(id: string) {
        setPendingDeleteId(id);
    }

    async function confirmDelete() {
        if (!pendingDeleteId) return;
        await onDelete?.(pendingDeleteId);
        setPendingDeleteId(null);
    }

    return (
        <GlassCard className="timeline-card">
            <SectionHeader
                title="Trip Timeline"
                icon="📋"
                subtitle={`${tripDays}-day expedition plan`}
                onAdd={onAdd ? openAdd : undefined}
                addLabel="Add timeline event"
            />

            {pendingDeleteId && (() => {
                const event = dayEvents.find(e => e.id === pendingDeleteId);
                return (
                    <div className="gear-card__delete-confirm">
                        <span>Remove <strong>{event?.title ?? 'this event'}</strong>?</span>
                        <div className="gear-card__delete-confirm-actions">
                            <button className="gear-card__delete-confirm-btn gear-card__delete-confirm-btn--cancel" onClick={() => setPendingDeleteId(null)}>Cancel</button>
                            <button className="gear-card__delete-confirm-btn gear-card__delete-confirm-btn--confirm" onClick={confirmDelete}>Remove</button>
                        </div>
                    </div>
                );
            })()}

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
                            {(onUpdate || onDelete) && (
                                <div className="row-actions">
                                    {onUpdate && (
                                        <button
                                            className="row-actions__btn row-actions__btn--edit"
                                            onClick={() => openEdit(event)}
                                            aria-label={`Edit ${event.title}`}
                                            title="Edit event"
                                        >
                                            ✏️
                                        </button>
                                    )}
                                    {onDelete && (
                                        <button
                                            className="row-actions__btn row-actions__btn--delete"
                                            onClick={() => handleDelete(event.id)}
                                            aria-label={`Delete ${event.title}`}
                                            title="Delete event"
                                        >
                                            🗑️
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            <TimelineFormSheet
                isOpen={sheetOpen}
                onClose={() => setSheetOpen(false)}
                onSubmit={handleFormSubmit}
                initialEvent={editingEvent}
                defaultDay={selectedDay}
                tripDays={tripDays}
                nextSortOrder={nextSortOrder}
            />
        </GlassCard>
    );
}
