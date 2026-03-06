'use client';

import React, { useState } from 'react';
import type { Meal } from '@/types';
import { groupBy } from '@/lib/helpers';
import GlassCard from '@/components/ui/GlassCard';
import SectionHeader from '@/components/ui/SectionHeader';

interface MealPlannerCardProps {
    meals: Meal[];
    totalDays: number;
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

export default function MealPlannerCard({ meals, totalDays }: MealPlannerCardProps) {
    const [selectedDay, setSelectedDay] = useState(1);
    const byDay = groupBy(meals, (m) => String(m.day_number));
    const dayMeals = byDay[String(selectedDay)] || [];
    const ordered = mealOrder
        .map((type) => dayMeals.find((m) => m.meal_type === type))
        .filter(Boolean) as Meal[];

    const totalCalories = ordered.reduce((sum, m) => sum + m.calories, 0);

    return (
        <GlassCard className="meal-card">
            <SectionHeader title="Meal Planner" icon="🍲" />

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
        </GlassCard>
    );
}
