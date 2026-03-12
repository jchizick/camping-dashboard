'use client';

import React, { useState } from 'react';
import type { TimelineEvent } from '@/types';
import CrudSheet from '@/components/ui/CrudSheet';

interface TimelineFormSheetProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: Omit<TimelineEvent, 'id' | 'trip_id'>) => Promise<void>;
    initialEvent?: TimelineEvent;
    defaultDay?: number;
    tripDays: number;
    nextSortOrder?: number;
}

export default function TimelineFormSheet({ isOpen, onClose, onSubmit, initialEvent, defaultDay = 1, tripDays, nextSortOrder = 100 }: TimelineFormSheetProps) {
    const defaultForm = {
        day_number: defaultDay,
        event_time: '09:00',
        title: '',
        details: '',
        sort_order: nextSortOrder,
    };

    const [form, setForm] = useState(initialEvent ?? defaultForm);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    function set<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
        setForm((prev) => ({ ...prev, [key]: val }));
    }

    React.useEffect(() => {
        if (isOpen) {
            setForm(initialEvent ?? { ...defaultForm, day_number: defaultDay, sort_order: nextSortOrder });
            setError(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, initialEvent]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!form.title.trim()) { setError('Event title is required'); return; }
        setSaving(true);
        try {
            await onSubmit(form);
            onClose();
        } catch {
            setError('Failed to save. Please try again.');
        } finally {
            setSaving(false);
        }
    }

    const isEdit = !!initialEvent;

    return (
        <CrudSheet isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Event' : 'Add Event'}>
            <form className="crud-form" onSubmit={handleSubmit} noValidate>

                <div className="crud-form__row">
                    <div className="crud-form__field">
                        <label className="crud-form__label" htmlFor="event-day">Day</label>
                        <select
                            id="event-day"
                            className="crud-form__select"
                            value={form.day_number}
                            onChange={(e) => set('day_number', parseInt(e.target.value))}
                        >
                            {Array.from({ length: tripDays }, (_, i) => i + 1).map((d) => (
                                <option key={d} value={d}>Day {d}</option>
                            ))}
                        </select>
                    </div>

                    <div className="crud-form__field">
                        <label className="crud-form__label" htmlFor="event-time">Time</label>
                        <input
                            id="event-time"
                            className="crud-form__input"
                            type="time"
                            value={form.event_time}
                            onChange={(e) => set('event_time', e.target.value)}
                        />
                    </div>
                </div>

                <div className="crud-form__field">
                    <label className="crud-form__label" htmlFor="event-title">Title *</label>
                    <input
                        id="event-title"
                        className="crud-form__input"
                        type="text"
                        value={form.title}
                        onChange={(e) => set('title', e.target.value)}
                        placeholder="e.g. Launch canoes"
                        required
                    />
                </div>

                <div className="crud-form__field">
                    <label className="crud-form__label" htmlFor="event-details">Details</label>
                    <textarea
                        id="event-details"
                        className="crud-form__textarea"
                        value={form.details}
                        onChange={(e) => set('details', e.target.value)}
                        rows={3}
                        placeholder="Optional details or notes…"
                    />
                </div>

                <div className="crud-form__field">
                    <label className="crud-form__label" htmlFor="event-sort">Sort Order</label>
                    <input
                        id="event-sort"
                        className="crud-form__input"
                        type="number"
                        min="0"
                        step="10"
                        value={form.sort_order}
                        onChange={(e) => set('sort_order', parseInt(e.target.value) || 0)}
                    />
                    <span className="crud-form__hint">Lower numbers appear first</span>
                </div>

                {error && <p className="crud-form__error">{error}</p>}

                <div className="crud-form__actions">
                    <button type="button" className="crud-form__btn crud-form__btn--cancel" onClick={onClose}>Cancel</button>
                    <button type="submit" className="crud-form__btn crud-form__btn--save" disabled={saving}>
                        {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Event'}
                    </button>
                </div>
            </form>
        </CrudSheet>
    );
}
