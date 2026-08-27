'use client';

import React from 'react';
import MealPlannerCard from '@/components/cards/MealPlannerCard';
import TimelineCard from '@/components/cards/TimelineCard';
import MobilePlanOverview from '@/components/plan/MobilePlanOverview';
import TripPageHeader, { TripSectionPage } from '@/components/trip/TripPageHeader';
import { useTripWorkspace } from '@/components/trip/TripWorkspaceProvider';

const mobilePlanCompositionQuery = '(max-width: 767px)';

function subscribeToMobilePlanComposition(onChange: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};

  const query = window.matchMedia(mobilePlanCompositionQuery);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function getMobilePlanCompositionSnapshot() {
  return typeof window !== 'undefined' &&
    Boolean(window.matchMedia) &&
    window.matchMedia(mobilePlanCompositionQuery).matches;
}

export default function TripPlanPage() {
  const { data, trip, crew, meals, timeline, tripDays, editableActions } = useTripWorkspace();
  const usesMobilePlanComposition = React.useSyncExternalStore(
    subscribeToMobilePlanComposition,
    getMobilePlanCompositionSnapshot,
    () => false
  );

  if (!data || !trip) return null;

  return (
    <TripSectionPage route="plan">
      <TripPageHeader
        title="Plan"
        description={
          usesMobilePlanComposition
            ? 'Trip details, schedule and meals'
            : 'Schedule and meals'
        }
      />
      {usesMobilePlanComposition ? (
        <MobilePlanOverview
          trip={trip}
          timeline={timeline}
          meals={meals}
          crew={crew}
          tripDays={tripDays}
          showMeals={data.settings.show_meals}
          onUpdateTripDetails={editableActions?.updateTripDetails}
          onSaveLocation={editableActions?.saveCampsite}
          onAddEvent={editableActions?.addTimelineEvent}
          onUpdateEvent={editableActions?.updateTimelineEvent}
          onDeleteEvent={editableActions?.deleteTimelineEvent}
          onAddMeal={editableActions?.addMeal}
          onUpdateMeal={editableActions?.updateMeal}
          onDeleteMeal={editableActions?.deleteMeal}
        />
      ) : (
        <div
          className="trip-operational-grid grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start"
          data-plan-composition="desktop"
        >
          <div className={`trip-section-surface trip-section-surface--primary min-h-0 ${data.settings.show_meals ? 'lg:col-span-8' : 'lg:col-span-12'}`}>
            <TimelineCard
              events={timeline}
              tripDays={tripDays}
              onAdd={editableActions?.addTimelineEvent}
              onUpdate={editableActions?.updateTimelineEvent}
              onDelete={editableActions?.deleteTimelineEvent}
            />
          </div>
          {data.settings.show_meals && (
            <div className="trip-section-surface trip-section-surface--secondary lg:col-span-4">
              <MealPlannerCard
                meals={meals}
                crew={crew}
                totalDays={tripDays}
                onAdd={editableActions?.addMeal}
                onUpdate={editableActions?.updateMeal}
                onDelete={editableActions?.deleteMeal}
              />
            </div>
          )}
        </div>
      )}
    </TripSectionPage>
  );
}
