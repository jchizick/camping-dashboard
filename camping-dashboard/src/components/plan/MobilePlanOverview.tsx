'use client';

import React, { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  CalendarDays,
  Check,
  MapPin,
  Pencil,
  Plus,
  Route,
  Trash2,
  Utensils,
} from 'lucide-react';
import type {
  CrewMember,
  Meal,
  TimelineEvent,
  TripDashboard,
  TripDetailsUpdate,
} from '@/types';
import { resolveCrewResponsibility } from '@/lib/crewResponsibility';
import type { CampsiteSelection } from '@/components/maps/CampsiteMapSelector';
import TimelineFormSheet from '@/components/cards/TimelineFormSheet';
import MealFormSheet from '@/components/cards/MealFormSheet';
import { formatTripDuration, getTripDuration } from '@/lib/tripDuration';
import TripDetailsSheet from './TripDetailsSheet';
import {
  formatPlanDateRange,
  formatPlanDayDate,
  getLatestPlannedDay,
  getPlanDayEvents,
  getPlanDayMeals,
  getTripCampsite,
  getTripDestination,
} from './planViewModel';

const CampsiteLocationSheet = dynamic(
  () => import('@/components/maps/CampsiteLocationSheet'),
  { ssr: false }
);

interface MobilePlanOverviewProps {
  trip: TripDashboard;
  timeline: TimelineEvent[];
  meals: Meal[];
  crew?: CrewMember[];
  tripDays: number;
  showMeals: boolean;
  onUpdateTripDetails?: (details: TripDetailsUpdate) => Promise<void>;
  onSaveLocation?: (selection: CampsiteSelection) => Promise<void>;
  onAddEvent?: (event: Omit<TimelineEvent, 'id' | 'trip_id'>) => Promise<void>;
  onUpdateEvent?: (
    id: string,
    patch: Partial<Omit<TimelineEvent, 'id' | 'trip_id'>>
  ) => Promise<void>;
  onDeleteEvent?: (id: string) => Promise<void>;
  onAddMeal?: (meal: Omit<Meal, 'id' | 'trip_id'>) => Promise<void>;
  onUpdateMeal?: (
    id: string,
    patch: Partial<Omit<Meal, 'id' | 'trip_id'>>
  ) => Promise<void>;
  onDeleteMeal?: (id: string) => Promise<void>;
}

const mealTypeLabels: Record<Meal['meal_type'], string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

function initialCampsiteSelection(trip: TripDashboard): CampsiteSelection | null {
  if (
    typeof trip.campsite_latitude !== 'number' ||
    !Number.isFinite(trip.campsite_latitude) ||
    typeof trip.campsite_longitude !== 'number' ||
    !Number.isFinite(trip.campsite_longitude)
  ) {
    return null;
  }

  return {
    latitude: trip.campsite_latitude,
    longitude: trip.campsite_longitude,
    label: trip.campsite_label,
    source:
      trip.campsite_source === 'maptiler_geocoding_refined'
        ? 'maptiler_geocoding_refined'
        : 'manual_map_selection',
    osmId: trip.campsite_osm_id,
  };
}

function IconAction({
  label,
  tone = 'default',
  onClick,
  children,
}: {
  label: string;
  tone?: 'default' | 'danger';
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      data-tone={tone}
      className="mobile-plan-icon-action"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export default function MobilePlanOverview({
  trip,
  timeline,
  meals,
  crew = [],
  tripDays,
  showMeals,
  onUpdateTripDetails,
  onSaveLocation,
  onAddEvent,
  onUpdateEvent,
  onDeleteEvent,
  onAddMeal,
  onUpdateMeal,
  onDeleteMeal,
}: MobilePlanOverviewProps) {
  const dayCount = Math.max(tripDays, 1);
  const [selectedDayState, setSelectedDay] = useState(1);
  const selectedDay = Math.min(Math.max(selectedDayState, 1), dayCount);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [eventSheetOpen, setEventSheetOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TimelineEvent | undefined>();
  const [pendingEventDelete, setPendingEventDelete] = useState<TimelineEvent | null>(null);
  const [mealSheetOpen, setMealSheetOpen] = useState(false);
  const [editingMeal, setEditingMeal] = useState<Meal | undefined>();
  const [pendingMealDelete, setPendingMealDelete] = useState<Meal | null>(null);

  const dayEvents = useMemo(
    () => getPlanDayEvents(timeline, selectedDay),
    [selectedDay, timeline]
  );
  const dayMeals = useMemo(
    () => getPlanDayMeals(meals, selectedDay),
    [meals, selectedDay]
  );
  const latestPlannedDay = useMemo(
    () => getLatestPlannedDay(timeline, meals),
    [meals, timeline]
  );
  const campsiteSelection = useMemo(() => initialCampsiteSelection(trip), [trip]);
  const duration = getTripDuration(trip.start_date, trip.end_date);
  const selectedDate = formatPlanDayDate(trip.start_date, selectedDay);
  const nextEventSortOrder =
    dayEvents.length > 0
      ? Math.max(...dayEvents.map((event) => event.sort_order)) + 10
      : 10;
  const totalCalories = dayMeals.reduce(
    (total, meal) => total + (Number.isFinite(meal.calories) ? meal.calories : 0),
    0
  );

  function openAddEvent() {
    setEditingEvent(undefined);
    setEventSheetOpen(true);
  }

  function openEditEvent(event: TimelineEvent) {
    setEditingEvent(event);
    setEventSheetOpen(true);
  }

  async function saveEvent(data: Omit<TimelineEvent, 'id' | 'trip_id'>) {
    if (editingEvent) await onUpdateEvent?.(editingEvent.id, data);
    else await onAddEvent?.(data);
  }

  function openAddMeal() {
    setEditingMeal(undefined);
    setMealSheetOpen(true);
  }

  function openEditMeal(meal: Meal) {
    setEditingMeal(meal);
    setMealSheetOpen(true);
  }

  async function saveMeal(data: Omit<Meal, 'id' | 'trip_id'>) {
    if (editingMeal) await onUpdateMeal?.(editingMeal.id, data);
    else await onAddMeal?.(data);
  }

  return (
    <div className="mobile-plan-overview" data-plan-composition="mobile">
      <section
        className="mobile-plan-essentials"
        aria-labelledby="mobile-plan-essentials-title"
      >
        <div className="mobile-plan-section-heading">
          <div>
            <p>Trip essentials</p>
            <h2 id="mobile-plan-essentials-title">Where and when</h2>
          </div>
          {onUpdateTripDetails ? (
            <button type="button" onClick={() => setDetailsOpen(true)}>
              <Pencil size={14} aria-hidden="true" />
              Edit details
            </button>
          ) : null}
        </div>

        <dl className="mobile-plan-essentials__grid">
          <div>
            <MapPin size={16} aria-hidden="true" />
            <dt>Destination</dt>
            <dd>{getTripDestination(trip)}</dd>
          </div>
          <div>
            <Route size={16} aria-hidden="true" />
            <dt>Campsite</dt>
            <dd>{getTripCampsite(trip)}</dd>
          </div>
          <div className="mobile-plan-essentials__dates">
            <CalendarDays size={16} aria-hidden="true" />
            <dt>Dates</dt>
            <dd>{formatPlanDateRange(trip.start_date, trip.end_date)}</dd>
            {duration ? <small>{formatTripDuration(duration)}</small> : null}
          </div>
        </dl>

        {onSaveLocation ? (
          <button
            type="button"
            className="mobile-plan-location-action"
            onClick={() => setLocationOpen(true)}
          >
            <MapPin size={15} aria-hidden="true" />
            {campsiteSelection ? 'Reposition campsite' : 'Set campsite location'}
          </button>
        ) : null}
      </section>

      <section
        className="mobile-plan-workspace"
        aria-labelledby="mobile-plan-day-title"
      >
        <div
          className="mobile-plan-day-selector custom-scrollbar"
          role="group"
          aria-label="Trip days"
        >
          {Array.from({ length: dayCount }, (_, index) => index + 1).map((day) => {
            const dayDate = formatPlanDayDate(trip.start_date, day);
            const selected = selectedDay === day;
            return (
              <button
                key={day}
                type="button"
                aria-pressed={selected}
                onClick={() => setSelectedDay(day)}
              >
                <span>
                  {selected ? <Check size={12} aria-hidden="true" /> : null}
                  Day {day}
                </span>
                {dayDate ? <small>{dayDate}</small> : null}
              </button>
            );
          })}
        </div>

        <header className="mobile-plan-selected-day">
          <p>Selected day</p>
          <h2 id="mobile-plan-day-title" data-mobile-type-role="selected-day">
            Day {selectedDay}{selectedDate ? ` · ${selectedDate}` : ''}
          </h2>
        </header>

        <section
          className="mobile-plan-itinerary"
          aria-labelledby="mobile-plan-itinerary-title"
        >
          <div className="mobile-plan-section-heading">
            <div>
              <p>Schedule</p>
              <h3 id="mobile-plan-itinerary-title">Itinerary</h3>
            </div>
            {onAddEvent ? (
              <button type="button" onClick={openAddEvent} aria-label="Add itinerary event">
                <Plus size={15} aria-hidden="true" />
                Add event
              </button>
            ) : null}
          </div>

          {dayEvents.length === 0 ? (
            <div className="mobile-plan-empty" role="status">
              <p>No itinerary items yet.</p>
            </div>
          ) : (
            <ol className="mobile-plan-itinerary__list">
              {dayEvents.map((event) => {
                const meaningfulPhase = event.phase && event.phase !== 'None';
                return (
                  <li key={event.id}>
                    <time>{event.event_time}</time>
                    <span className="mobile-plan-itinerary__marker" aria-hidden="true" />
                    <div className="mobile-plan-itinerary__content">
                      <div className="mobile-plan-item-heading">
                        <h4>{event.title}</h4>
                        {meaningfulPhase ? <span>{event.phase}</span> : null}
                      </div>
                      {event.details ? <p>{event.details}</p> : null}
                      {onUpdateEvent || onDeleteEvent ? (
                        <div className="mobile-plan-item-actions">
                          {onUpdateEvent ? (
                            <IconAction
                              label={`Edit ${event.title}`}
                              onClick={() => openEditEvent(event)}
                            >
                              <Pencil size={15} aria-hidden="true" />
                            </IconAction>
                          ) : null}
                          {onDeleteEvent ? (
                            <IconAction
                              label={`Remove ${event.title}`}
                              tone="danger"
                              onClick={() => setPendingEventDelete(event)}
                            >
                              <Trash2 size={15} aria-hidden="true" />
                            </IconAction>
                          ) : null}
                        </div>
                      ) : null}
                      {pendingEventDelete?.id === event.id ? (
                        <div className="mobile-plan-delete-confirmation" role="alert">
                          <span>Remove this event?</span>
                          <button type="button" onClick={() => setPendingEventDelete(null)}>
                            Cancel
                          </button>
                          <button
                            type="button"
                            data-tone="danger"
                            onClick={async () => {
                              await onDeleteEvent?.(event.id);
                              setPendingEventDelete(null);
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {showMeals ? (
          <section
            className="mobile-plan-meals"
            aria-labelledby="mobile-plan-meals-title"
          >
            <div className="mobile-plan-section-heading">
              <div>
                <p>Food plan</p>
                <h3 id="mobile-plan-meals-title">Meals</h3>
              </div>
              {onAddMeal ? (
                <button type="button" onClick={openAddMeal} aria-label="Add meal">
                  <Plus size={15} aria-hidden="true" />
                  Add meal
                </button>
              ) : null}
            </div>

            {dayMeals.length === 0 ? (
              <div className="mobile-plan-empty" role="status">
                <p>No meals planned for this day.</p>
              </div>
            ) : (
              <ul className="mobile-plan-meals__list">
                {dayMeals.map((meal) => {
                  const prepLead = resolveCrewResponsibility(
                    meal.prep_crew_member_id,
                    meal.assigned_to,
                    crew
                  );
                  return <li key={meal.id}>
                    <Utensils size={16} aria-hidden="true" />
                    <div className="mobile-plan-meal__content">
                      <p className="mobile-plan-meal__type">
                        {mealTypeLabels[meal.meal_type]}
                      </p>
                      <h4>{meal.title}</h4>
                      {prepLead.kind !== 'unassigned' ? (
                        <p className="mobile-plan-meal__prep-lead">
                          Prep · {prepLead.label}
                        </p>
                      ) : null}
                      {meal.notes ? <p className="mobile-plan-meal__notes">{meal.notes}</p> : null}
                      <p className="mobile-plan-meal__calories">{meal.calories} kcal</p>
                      {onUpdateMeal || onDeleteMeal ? (
                        <div className="mobile-plan-item-actions">
                          {onUpdateMeal ? (
                            <IconAction
                              label={`Edit ${meal.title}`}
                              onClick={() => openEditMeal(meal)}
                            >
                              <Pencil size={15} aria-hidden="true" />
                            </IconAction>
                          ) : null}
                          {onDeleteMeal ? (
                            <IconAction
                              label={`Remove ${meal.title}`}
                              tone="danger"
                              onClick={() => setPendingMealDelete(meal)}
                            >
                              <Trash2 size={15} aria-hidden="true" />
                            </IconAction>
                          ) : null}
                        </div>
                      ) : null}
                      {pendingMealDelete?.id === meal.id ? (
                        <div className="mobile-plan-delete-confirmation" role="alert">
                          <span>Remove this meal?</span>
                          <button type="button" onClick={() => setPendingMealDelete(null)}>
                            Cancel
                          </button>
                          <button
                            type="button"
                            data-tone="danger"
                            onClick={async () => {
                              await onDeleteMeal?.(meal.id);
                              setPendingMealDelete(null);
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </li>
                })}
              </ul>
            )}

            {dayMeals.length > 0 ? (
              <p className="mobile-plan-meals__total">
                Day total <strong>{totalCalories} kcal</strong>
              </p>
            ) : null}
          </section>
        ) : null}
      </section>

      {onUpdateTripDetails ? (
        <TripDetailsSheet
          isOpen={detailsOpen}
          trip={trip}
          latestPlannedDay={latestPlannedDay}
          onClose={() => setDetailsOpen(false)}
          onSubmit={onUpdateTripDetails}
        />
      ) : null}

      {onSaveLocation ? (
        <CampsiteLocationSheet
          isOpen={locationOpen}
          initialValue={campsiteSelection}
          mapStyle={trip.map_style}
          isProvisional={trip.campsite_source === 'legacy_site_coordinates_unverified'}
          onClose={() => setLocationOpen(false)}
          onSave={onSaveLocation}
        />
      ) : null}

      {(onAddEvent || onUpdateEvent) ? (
        <TimelineFormSheet
          isOpen={eventSheetOpen}
          onClose={() => setEventSheetOpen(false)}
          onSubmit={saveEvent}
          initialEvent={editingEvent}
          defaultDay={selectedDay}
          tripDays={dayCount}
          nextSortOrder={nextEventSortOrder}
        />
      ) : null}

      {(onAddMeal || onUpdateMeal) ? (
        <MealFormSheet
          isOpen={mealSheetOpen}
          onClose={() => setMealSheetOpen(false)}
          onSubmit={saveMeal}
          initialMeal={editingMeal}
          defaultDay={selectedDay}
          totalDays={dayCount}
          crew={crew}
        />
      ) : null}
    </div>
  );
}
