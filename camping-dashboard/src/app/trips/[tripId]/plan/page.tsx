'use client';

import MobilePlanOverview from '@/components/plan/MobilePlanOverview';
import TripPageHeader, { TripSectionPage } from '@/components/trip/TripPageHeader';
import { useTripWorkspace } from '@/components/trip/TripWorkspaceProvider';
import { usePhoneLayout } from '@/components/trip/PhoneLayoutProvider';

export default function TripPlanPage() {
  const { data, trip, crew, meals, timeline, tripDays, editableActions } = useTripWorkspace();
  const usesMobilePlanComposition = usePhoneLayout();

  // Primary desktop routes are composed by TripAppShell, online and offline.
  if (!data || !trip || !usesMobilePlanComposition) return null;

  return (
    <TripSectionPage route="plan">
      <TripPageHeader
        title="Plan"
        distressed
        description="Trip details, schedule and meals"
      />
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
    </TripSectionPage>
  );
}
