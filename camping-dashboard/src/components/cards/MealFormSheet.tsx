'use client';

import React, { useState } from 'react';
import type { Meal, MealType, PrepType } from '@/types';
import CrudSheet from '@/components/ui/CrudSheet';
import { Leaf, Flame, Coffee, Store } from 'lucide-react';

interface MealFormSheetProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: Omit<Meal, 'id' | 'trip_id'>) => Promise<void>;
    initialMeal?: Meal;
    defaultDay?: number;
    totalDays: number;
}

export default function MealFormSheet({ isOpen, onClose, onSubmit, initialMeal, defaultDay = 1, totalDays }: MealFormSheetProps) {
    const defaultForm = {
        day_number: defaultDay,
        meal_type: 'breakfast' as MealType,
        title: '',
        prep_type: 'fresh' as PrepType,
        calories: 0,
        assigned_to: '',
        notes: '',
    };

    const [form, setForm] = useState(initialMeal ?? defaultForm);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    function set<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
        setForm((prev) => ({ ...prev, [key]: val }));
    }

    React.useEffect(() => {
        if (isOpen) {
            setForm(initialMeal ?? { ...defaultForm, day_number: defaultDay });
            setError(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, initialMeal]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!form.title.trim()) { setError('Meal title is required'); return; }
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

    const isEdit = !!initialMeal;

    return (
        <CrudSheet isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Meal' : 'Add Meal'}>
            <form className="crud-form" onSubmit={handleSubmit} noValidate>

                <div className="crud-form__row">
                    <div className="crud-form__field">
                        <label className="crud-form__label" htmlFor="meal-day">Day</label>
                        <select
                            id="meal-day"
                            className="crud-form__select"
                            value={form.day_number}
                            onChange={(e) => set('day_number', parseInt(e.target.value))}
                        >
                            {Array.from({ length: totalDays }, (_, i) => i + 1).map((d) => (
                                <option key={d} value={d}>Day {d}</option>
                            ))}
                        </select>
                    </div>

                    <div className="crud-form__field">
                        <label className="crud-form__label" htmlFor="meal-type">Meal</label>
                        <select
                            id="meal-type"
                            className="crud-form__select"
                            value={form.meal_type}
                            onChange={(e) => set('meal_type', e.target.value as MealType)}
                        >
                            <option value="breakfast">Breakfast</option>
                            <option value="lunch">Lunch</option>
                            <option value="dinner">Dinner</option>
                            <option value="snack">Snack</option>
                        </select>
                    </div>
                </div>

                <div className="crud-form__field">
                    <label className="crud-form__label" htmlFor="meal-title">Title *</label>
                    <input
                        id="meal-title"
                        className="crud-form__input"
                        type="text"
                        value={form.title}
                        onChange={(e) => set('title', e.target.value)}
                        placeholder="e.g. Oatmeal with Berries"
                        required
                    />
                </div>

                <div className="crud-form__field">
                    <label className="crud-form__label">Prep Type</label>
                    <div className="flex gap-2">
                        {[
                            { id: 'fresh', icon: Leaf, label: 'Fresh' },
                            { id: 'dehydrated', icon: Flame, label: 'Dehydrated' },
                            { id: 'fire', icon: Coffee, label: 'Fire' },
                            { id: 'restaurant', icon: Store, label: 'Restaurant' },
                        ].map(({ id, icon: Icon, label }) => (
                            <button
                                key={id}
                                type="button"
                                onClick={() => set('prep_type', id as PrepType)}
                                title={label}
                                className={`flex items-center justify-center p-2 rounded transition-colors flex-1 border ${
                                    form.prep_type === id
                                        ? 'bg-border-subtle text-accent-yellow border-accent-yellow/30'
                                        : 'bg-card-bg text-text-muted border-border-subtle hover:bg-card-hover hover:text-text-main'
                                }`}
                            >
                                <Icon size={16} />
                            </button>
                        ))}
                    </div>
                </div>

                <div className="crud-form__field">
                    <label className="crud-form__label" htmlFor="meal-cal">Calories</label>
                    <input
                        id="meal-cal"
                        className="crud-form__input"
                        type="number"
                        min="0"
                        step="10"
                        value={form.calories}
                        onChange={(e) => set('calories', parseInt(e.target.value) || 0)}
                    />
                </div>

                <div className="crud-form__field">
                    <label className="crud-form__label" htmlFor="meal-assigned">Assigned To</label>
                    <input
                        id="meal-assigned"
                        className="crud-form__input"
                        type="text"
                        value={form.assigned_to}
                        onChange={(e) => set('assigned_to', e.target.value)}
                        placeholder="e.g. Jordan"
                    />
                </div>

                <div className="crud-form__field">
                    <label className="crud-form__label" htmlFor="meal-notes">Notes</label>
                    <textarea
                        id="meal-notes"
                        className="crud-form__textarea"
                        value={form.notes}
                        onChange={(e) => set('notes', e.target.value)}
                        rows={2}
                        placeholder="Optional notes…"
                    />
                </div>

                {error && <p className="crud-form__error">{error}</p>}

                <div className="crud-form__actions">
                    <button type="button" className="crud-form__btn crud-form__btn--cancel" onClick={onClose}>Cancel</button>
                    <button type="submit" className="crud-form__btn crud-form__btn--save" disabled={saving}>
                        {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Meal'}
                    </button>
                </div>
            </form>
        </CrudSheet>
    );
}
