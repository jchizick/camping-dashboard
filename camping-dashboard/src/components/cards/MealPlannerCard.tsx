'use client';

import React, { useState } from 'react';
import type { Meal } from '@/types';
import { groupBy } from '@/lib/helpers';
import { useTheme } from '@/lib/themeContext';
import { Card } from '@/components/ui/Primitives';
import MealFormSheet from '@/components/cards/MealFormSheet';
import { Utensils, Plus, Pencil, Trash2, Flame, Leaf, Coffee, Store } from 'lucide-react';

interface MealPlannerCardProps {
    meals: Meal[];
    totalDays: number;
    onAdd?: (meal: Omit<Meal, 'id' | 'trip_id'>) => Promise<void>;
    onUpdate?: (id: string, patch: Partial<Omit<Meal, 'id' | 'trip_id'>>) => Promise<void>;
    onDelete?: (id: string) => Promise<void>;
}

const mealOrder = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

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

    async function confirmDelete() {
        if (!pendingDeleteId) return;
        await onDelete?.(pendingDeleteId);
        setPendingDeleteId(null);
    }

    const { labels } = useTheme();

    return (
        <Card 
            title={labels.meals} 
            icon={Utensils} 
            className="meal-planner-card"
            action={onAdd && (
                <button type="button" aria-label="Add meal" onClick={openAdd} className="flex size-10 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-yellow/60">
                    <Plus size={16} aria-hidden="true" />
                </button>
            )}
        >
            <div className="flex gap-2 mb-6 overflow-x-auto custom-scrollbar pb-2 shrink-0">
                {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => (
                    <button
                        key={day}
                        type="button"
                        onClick={() => setSelectedDay(day)}
                        aria-pressed={selectedDay === day}
                        className={`min-h-10 rounded-full border px-3 text-xs font-mono whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-yellow/60 ${
                            selectedDay === day 
                                ? 'bg-border-subtle text-text-main border-border-subtle' 
                                : 'bg-transparent text-text-muted border-border-subtle hover:bg-card-hover'
                        }`}
                    >
                        Day {day}
                    </button>
                ))}
            </div>

            {pendingDeleteId && (() => {
                const meal = meals.find(m => m.id === pendingDeleteId);
                return (
                    <div className="bg-accent-red/10 border border-accent-red/20 text-accent-red p-3 mb-4 rounded-xl flex items-center justify-between text-sm shrink-0">
                        <span>Remove <strong>{meal?.title ?? 'this meal'}</strong>?</span>
                        <div className="flex gap-2">
                            <button type="button" className="min-h-10 rounded border border-border-subtle bg-card-bg px-3 text-xs text-text-muted hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-yellow/60" onClick={() => setPendingDeleteId(null)}>Cancel</button>
                            <button type="button" className="min-h-10 rounded bg-accent-red px-3 text-xs font-bold text-bg-main hover:bg-accent-red/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red/60" onClick={confirmDelete}>Remove</button>
                        </div>
                    </div>
                );
            })()}

            <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-2 min-h-[250px]">
                {ordered.length === 0 ? (
                    <div className="text-center text-sm text-text-muted py-8 font-mono opacity-50">
                        No meals planned to eat for Day {selectedDay} yet
                    </div>
                ) : (
                    ordered.map((meal) => {
                        let PrepIcon = Utensils;
                        if (meal.prep_type === 'dehydrated') PrepIcon = Flame;
                        if (meal.prep_type === 'fresh') PrepIcon = Leaf;
                        if (meal.prep_type === 'fire') PrepIcon = Coffee;
                        if (meal.prep_type === 'restaurant') PrepIcon = Store;
                        
                        return (
                            <div key={meal.id} className="group relative flex items-center gap-4 p-3 rounded-xl hover:bg-card-hover transition-colors border border-transparent hover:border-border-subtle">
                                <div className="w-10 h-10 rounded-full bg-card-bg border border-border-subtle flex items-center justify-center shrink-0">
                                    <PrepIcon size={16} className="text-accent-yellow" />
                                </div>
                                <div className="flex-1">
                                    <div className="text-[10px] font-bold tracking-widest text-accent-yellow uppercase mb-0.5">{meal.meal_type}</div>
                                    <div className="text-sm font-medium text-text-main">{meal.title}</div>
                                    {meal.notes && <div className="text-xs text-text-muted leading-tight mt-0.5">{meal.notes}</div>}
                                </div>
                                <div className="text-sm font-mono text-text-main whitespace-nowrap flex items-center gap-3">
                                    <span>{meal.calories} <span className="text-text-muted text-xs">kcal</span></span>
                                    
                                    {(onUpdate || onDelete) && (
                                        <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                                            {onUpdate && (
                                                <button type="button" aria-label={`Edit ${meal.title}`} className="flex size-10 items-center justify-center rounded text-text-muted transition-colors hover:bg-border-subtle hover:text-accent-yellow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-yellow/60" onClick={() => openEdit(meal)}>
                                                    <Pencil size={14} aria-hidden="true" />
                                                </button>
                                            )}
                                            {onDelete && (
                                                <button type="button" aria-label={`Remove ${meal.title}`} className="flex size-10 items-center justify-center rounded text-text-muted transition-colors hover:bg-border-subtle hover:text-accent-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red/60" onClick={() => setPendingDeleteId(meal.id)}>
                                                    <Trash2 size={14} aria-hidden="true" />
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {totalCalories > 0 && (
                <div className="mt-6 pt-4 border-t border-border-subtle flex justify-between items-center shrink-0">
                    <span className="text-sm text-text-muted">Day Total</span>
                    <span className="text-lg font-mono font-bold text-accent-yellow">{totalCalories} kcal</span>
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
        </Card>
    );
}
