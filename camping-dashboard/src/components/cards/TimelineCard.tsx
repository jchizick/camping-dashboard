'use client';

import React, { useState } from 'react';
import type { TimelineEvent } from '@/types';
import { groupBy } from '@/lib/helpers';
import { Card, Badge } from '@/components/ui/Primitives';
import TimelineFormSheet from '@/components/cards/TimelineFormSheet';
import { Clock, Plus, Pencil, Trash2 } from 'lucide-react';

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
    4: 'Day 4 — Hike Out',
};

export default function TimelineCard({ events, tripDays, onAdd, onUpdate, onDelete }: TimelineCardProps) {
    const [selectedDay, setSelectedDay] = useState<number>(1);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState<TimelineEvent | undefined>(undefined);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

    const grouped = groupBy(events, (e) => String(e.day_number));
    const dayEvents = (grouped[String(selectedDay)] || []).sort((a, b) => a.sort_order - b.sort_order);

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

    async function confirmDelete() {
        if (!pendingDeleteId) return;
        await onDelete?.(pendingDeleteId);
        setPendingDeleteId(null);
    }

    return (
        <Card 
            title="Trip Timeline" 
            icon={Clock} 
            className="h-full flex flex-col max-h-[600px]"
            action={onAdd && (
                <button onClick={openAdd} className="p-1 hover:bg-card-hover rounded text-text-muted transition-colors">
                    <Plus size={16} />
                </button>
            )}
        >
            <div className="text-sm text-text-muted mb-6">{tripDays}-day expedition plan</div>
            
            <div className="flex gap-2 mb-6 overflow-x-auto custom-scrollbar pb-2 shrink-0">
                {Array.from({ length: tripDays }, (_, i) => i + 1).map((day) => (
                    <button
                        key={day}
                        onClick={() => setSelectedDay(day)}
                        className={`px-4 py-1.5 rounded-full text-xs font-mono border whitespace-nowrap transition-colors ${
                            selectedDay === day 
                                ? 'bg-border-subtle text-text-main border-border-subtle' 
                                : 'bg-transparent text-text-muted border-border-subtle hover:bg-card-hover'
                        }`}
                    >
                        Day {day}
                    </button>
                ))}
            </div>

            <h3 className="text-sm font-bold text-text-main mb-4">
                {dayLabels[selectedDay] || `Day ${selectedDay}`}
            </h3>

            {pendingDeleteId && (() => {
                const event = dayEvents.find(e => e.id === pendingDeleteId);
                return (
                    <div className="bg-accent-red/10 border border-accent-red/20 text-accent-red p-3 mb-4 rounded-xl flex items-center justify-between text-sm shrink-0">
                        <span>Remove <strong>{event?.title ?? 'this event'}</strong>?</span>
                        <div className="flex gap-2">
                            <button className="px-3 py-1 bg-card-bg rounded border border-border-subtle hover:bg-card-hover text-text-muted text-xs" onClick={() => setPendingDeleteId(null)}>Cancel</button>
                            <button className="px-3 py-1 bg-accent-red text-bg-main rounded hover:bg-accent-red/80 font-bold text-xs" onClick={confirmDelete}>Remove</button>
                        </div>
                    </div>
                );
            })()}

            <div className="relative space-y-6 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {dayEvents.length > 0 && <div className="absolute left-[60px] top-2 bottom-2 w-px bg-border-subtle z-0" />}
                
                {dayEvents.length === 0 ? (
                    <div className="text-center text-sm text-text-muted py-8 font-mono opacity-50 relative z-10 bg-card-bg">
                        No events planned for this day yet
                    </div>
                ) : (
                    dayEvents.map((event, i) => (
                        <div key={event.id} className="relative flex gap-6 group hover:bg-card-hover/30 p-2 -my-2 -mx-2 rounded-lg transition-colors z-10">
                            <div className="w-12 text-xs font-mono text-accent-yellow pt-0.5 shrink-0 text-right">{event.event_time}</div>
                            
                            <div className="absolute left-[64px] top-3.5 w-2 h-2 rounded-full bg-card-bg border-2 border-accent-yellow z-20 group-hover:bg-accent-yellow transition-colors" />
                            
                            <div className="flex-1 pb-6 border-b border-border-subtle/30 last:border-0 last:pb-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <h4 className="text-sm font-medium text-text-main group-hover:text-accent-yellow transition-colors">{event.title}</h4>
                                    {event.phase && event.phase !== 'None' && (
                                        <Badge variant={event.phase === 'Transit' ? 'info' : event.phase === 'Setup' ? 'warning' : 'success'}>
                                            {event.phase}
                                        </Badge>
                                    )}
                                </div>
                                {event.details && <p className="text-xs text-text-muted leading-relaxed">{event.details}</p>}
                                
                                {/* Timeline Event Actions */}
                                {(onUpdate || onDelete) && (
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity mt-3">
                                        {onUpdate && (
                                            <button 
                                                className="p-1 text-text-muted hover:text-accent-yellow rounded hover:bg-border-subtle transition-colors"
                                                onClick={() => openEdit(event)}
                                            >
                                                <Pencil size={12} />
                                            </button>
                                        )}
                                        {onDelete && (
                                            <button 
                                                className="p-1 text-text-muted hover:text-accent-red rounded hover:bg-border-subtle transition-colors"
                                                onClick={() => setPendingDeleteId(event.id)}
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
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
        </Card>
    );
}
