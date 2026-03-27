'use client';

import React, { useState } from 'react';
import type { Meal } from '@/types';
import { groupBy } from '@/lib/helpers';
import GlassCard from '@/components/ui/GlassCard';
import SectionHeader from '@/components/ui/SectionHeader';
import MealFormSheet from '@/components/cards/MealFormSheet';

interface MealPlannerCardProps {
    meals: Meal[];
    totalDays: number;
    onAdd?: (meal: Omit<Meal, 'id' | 'trip_id'>) => Promise<void>;
    onUpdate?: (id: string, patch: Partial<Omit<Meal, 'id' | 'trip_id'>>) => Promise<void>;
    onDelete?: (id: string) => Promise<void>;
}

const mealOrder = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

const prepIcons: Record<string, string> = {
    dehydrated: '💨',
    fresh: '🥗',
    fire: '🔥',
};

const mealTypeLabel: Record<string, string> = {
    breakfast: 'Breakfast',
    lunch: 'Lunch',
    dinner: 'Dinner',
    snack: 'Snack',
};

export default function MealPlannerCard({ meals, totalDays, onAdd, onUpdate, onDelete }: MealPlannerCardProps) {
    const [selectedDay, setSelectedDay] = useState<number>(1);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [editingMeal, setEditingMeal] = useState<Meal | undefined>(undefined);

    const byDay = groupBy(meals, (m) => String(m.day_number));
    const dayMeals = byDay[String(selectedDay)] || [];
    const ordered = mealOrder
        .map((type) => dayMeals.find((m) => m.meal_type === type))
        .filter(Boolean) as Meal[];

    const totalCalories = ordered.reduce((sum, m) => sum + m.calories, 0);

    function openAdd() {
        setEditingMeal(undefined);
        setSheetOpen(true);
    }

    function openEdit(meal: Meal) {
        setEditingMeal(meal);
        setSheetOpen(true);
    }

    async function handleFormSubmit(data: Omit<Meal, 'id' | 'trip_id'>) {
        if (editingMeal) {
            await onUpdate?.(editingMeal.id, data);
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
        <GlassCard className="meal-card">
            <SectionHeader
                title="Meal Planner"
                icon="🍲"
                onAdd={onAdd ? openAdd : undefined}
                addLabel="Add meal"
            />

            {/* Inline delete confirmation banner */}
            {pendingDeleteId && (() => {
                const meal = meals.find(m => m.id === pendingDeleteId);
                return (
                    <div className="gear-card__delete-confirm">
                        <span>Remove <strong>{meal?.title ?? 'this meal'}</strong>?</span>
                        <div className="gear-card__delete-confirm-actions">
                            <button className="gear-card__delete-confirm-btn gear-card__delete-confirm-btn--cancel" onClick={() => setPendingDeleteId(null)}>Cancel</button>
                            <button className="gear-card__delete-confirm-btn gear-card__delete-confirm-btn--confirm" onClick={confirmDelete}>Remove</button>
                        </div>
                    </div>
                );
            })()}

            <div className="meal-card__day-tabs">
                {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => (
                    <button
                        key={day}
                        className={`meal-card__day-tab ${selectedDay === day ? 'meal-card__day-tab--active' : ''}`}
                        onClick={() => setSelectedDay(day)}
                    >
                        Day {day}
                    </button>
                ))}
            </div>

            <div className="meal-card__meals">
                {ordered.map((meal) => (
                    <div key={meal.id} className="meal-card__meal">
                        <span className="meal-card__prep-icon">{prepIcons[meal.prep_type]}</span>
                        <div className="meal-card__meal-info">
                            <span className="meal-card__meal-type">{mealTypeLabel[meal.meal_type]}</span>
                            <span className="meal-card__meal-title">{meal.title}</span>
                            {meal.notes && <span className="meal-card__meal-notes">{meal.notes}</span>}
                        </div>
                        <span className="meal-card__calories">{meal.calories} kcal</span>
                        {(onUpdate || onDelete) && (
                            <div className="row-actions">
                                {onUpdate && (
                                    <button
                                        className="row-actions__btn row-actions__btn--edit"
                                        onClick={() => openEdit(meal)}
                                        aria-label={`Edit ${meal.title}`}
                                        title="Edit meal"
                                    >
                                        ✏️
                                    </button>
                                )}
                                {onDelete && (
                                    <button
                                        className="row-actions__btn row-actions__btn--delete"
                                        onClick={() => handleDelete(meal.id)}
                                        aria-label={`Delete ${meal.title}`}
                                        title="Delete meal"
                                    >
                                        🗑️
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                ))}
                {ordered.length === 0 && (
                    <p className="meal-card__empty">No meals planned for Day {selectedDay}</p>
                )}
            </div>

            {totalCalories > 0 && (
                <div className="meal-card__total">
                    <span>Day Total</span>
                    <span className="meal-card__total-value">{totalCalories} kcal</span>
                </div>
            )}

            <MealFormSheet
                isOpen={sheetOpen}
                onClose={() => setSheetOpen(false)}
                onSubmit={handleFormSubmit}
                initialMeal={editingMeal}
                defaultDay={selectedDay}
                totalDays={totalDays}
            />
        </GlassCard>
    );
}
