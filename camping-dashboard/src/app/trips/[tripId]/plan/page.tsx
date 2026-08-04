'use client';

import MealPlannerCard from '@/components/cards/MealPlannerCard';
import TimelineCard from '@/components/cards/TimelineCard';
import TripPageHeader, { TripSectionPage } from '@/components/trip/TripPageHeader';
import { useTripWorkspace } from '@/components/trip/TripWorkspaceProvider';

export default function TripPlanPage() {
  const { data, meals, timeline, tripDays, editableActions } = useTripWorkspace();
  if (!data) return null;

  return (
    <TripSectionPage route="plan">
      <TripPageHeader title="Plan" description="Schedule and meals" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className={`trip-section-surface ${data.settings.show_meals ? 'lg:col-span-8' : 'lg:col-span-12'}`}>
          <TimelineCard
            events={timeline}
            tripDays={tripDays}
            onAdd={editableActions?.addTimelineEvent}
            onUpdate={editableActions?.updateTimelineEvent}
            onDelete={editableActions?.deleteTimelineEvent}
          />
        </div>
        {data.settings.show_meals && (
          <div className="trip-section-surface lg:col-span-4">
            <MealPlannerCard
              meals={meals}
              totalDays={tripDays}
              onAdd={editableActions?.addMeal}
              onUpdate={editableActions?.updateMeal}
              onDelete={editableActions?.deleteMeal}
            />
          </div>
        )}
      </div>
    </TripSectionPage>
  );
}
