'use client';

import { useId, useState } from 'react';
import type { Meal, TimelineEvent } from '@/types';
import { useTripWorkspace, type TripWorkspaceValue } from '@/components/trip/TripWorkspaceProvider';
import TimelineFormSheet from '@/components/cards/TimelineFormSheet';
import MealFormSheet from '@/components/cards/MealFormSheet';
import { resolveCrewResponsibility } from '@/lib/crewResponsibility';
import { useOptionalTripDraftGuard } from '@/components/trip/TripDraftGuardProvider';
import TripDetailsSheet from './TripDetailsSheet';
import { formatPlanDayDate, getLatestPlannedDay, getPlanDayEvents, getPlanDayMeals } from './planViewModel';
import './desktopWorkspacePlan.css';

function ItemDetails({ text, label, kind }: { text: string; label: string; kind: 'details' | 'notes' }) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  return <div className="dwp-details">
    <button type="button" aria-expanded={expanded} aria-controls={id}
      aria-label={`${expanded ? 'Hide' : 'Show'} ${label}`}
      onClick={() => setExpanded(!expanded)}>{expanded ? 'Hide' : 'Show'} {kind}</button>
    {expanded && <p id={id}>{text}</p>}
  </div>;
}

/** Route/day changes reset transient sheets only after guarded navigation succeeds. */
function PlanDay({ workspace, day, dayCount }: {
  workspace: TripWorkspaceValue; day: number; dayCount: number;
}) {
  const { trip, timeline, meals, crew, editableActions: actions, data } = workspace;
  const events = getPlanDayEvents(timeline, day);
  const dayMeals = getPlanDayMeals(meals, day);
  const [showAll, setShowAll] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [eventEditor, setEventEditor] = useState<{ item?: TimelineEvent } | null>(null);
  const [mealEditor, setMealEditor] = useState<{ item?: Meal } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ kind: 'event' | 'meal'; id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const totalCalories = dayMeals.reduce((sum, meal) => sum + (Number.isFinite(meal.calories) ? meal.calories : 0), 0);
  const incompleteCalories = dayMeals.some(meal => !Number.isFinite(meal.calories));
  const nextSortOrder = events.length ? Math.max(...events.map(event => event.sort_order)) + 10 : 10;

  async function confirmDelete() {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      if (pendingDelete.kind === 'event') await actions?.deleteTimelineEvent(pendingDelete.id);
      else await actions?.deleteMeal(pendingDelete.id);
      setPendingDelete(null);
    } catch {
      setDeleteError('Could not remove this item. Please try again.');
    } finally {
      setDeleting(false);
    }
  }

  return <>
    <div className="dwp-day-heading">
      <h3>Day {day} <span>— {formatPlanDayDate(trip!.start_date, day) ?? 'Date unavailable'}</span></h3>
      {actions?.updateTripDetails && <button type="button" onClick={() => setDetailsOpen(true)}>Edit trip details</button>}
    </div>
    <section className="dwp-timeline" aria-labelledby="desktop-plan-schedule-title">
      <div className="dwp-section-heading">
        <h3 id="desktop-plan-schedule-title">Schedule <span>{events.length} {events.length === 1 ? 'event' : 'events'}</span></h3>
        {actions?.addTimelineEvent && <button type="button" onClick={() => setEventEditor({})}>Add event</button>}
      </div>
      {events.length === 0 ? <p className="dwp-empty">No events planned for this day.</p> : <ol id="desktop-plan-events">
        {(showAll ? events : events.slice(0, 5)).map(event => <li key={event.id}>
          <span className="dwp-time">{event.event_time}</span>
          <div className="dwp-item-content">
            <h4>{event.title}</h4>
            {event.phase && <span className="dwp-phase">{event.phase}</span>}
            {event.details && <ItemDetails text={event.details} kind="details" label={`details for ${event.title}`} />}
          </div>
          {actions && <div className="dwp-item-actions">
            {<button type="button" aria-label={`Edit event: ${event.title}`} onClick={() => setEventEditor({ item: event })}>Edit</button>}
            {<button type="button" aria-label={`Remove event: ${event.title}`} onClick={() => { setDeleteError(null); setPendingDelete({ kind: 'event', id: event.id, title: event.title }); }}>Remove</button>}
          </div>}
        </li>)}
      </ol>}
      {events.length > 5 && <button className="dwp-disclosure" type="button" aria-expanded={showAll} aria-controls="desktop-plan-events"
        onClick={() => setShowAll(!showAll)}>{showAll ? 'Show fewer events' : `Show all ${events.length} events`}</button>}
    </section>

    {data!.settings.show_meals && <section className="dwp-meals" aria-labelledby="desktop-plan-meals-title">
      <div className="dwp-section-heading">
        <h3 id="desktop-plan-meals-title">Meals</h3>
        {actions?.addMeal && <button type="button" onClick={() => setMealEditor({})}>Add meal</button>}
      </div>
      {dayMeals.length === 0 ? <p className="dwp-empty">No meals planned for this day.</p> : <>
        <ul>{dayMeals.map(meal => {
          const lead = resolveCrewResponsibility(meal.prep_crew_member_id, meal.assigned_to, crew);
          return <li key={meal.id}>
            <span className="dwp-meal-type">{meal.meal_type}</span>
            <div className="dwp-item-content"><h4>{meal.title}</h4>
              {lead.kind !== 'unassigned' && <p className="dwp-meta">Prep · {lead.label}</p>}
              {meal.notes && <ItemDetails text={meal.notes} kind="notes" label={`notes for ${meal.title}`} />}
            </div>
            <span className="dwp-calories">{Number.isFinite(meal.calories) ? `${meal.calories} kcal` : 'kcal unavailable'}</span>
            {actions && <div className="dwp-item-actions">
              {<button type="button" aria-label={`Edit meal: ${meal.title}`} onClick={() => setMealEditor({ item: meal })}>Edit</button>}
              {<button type="button" aria-label={`Remove meal: ${meal.title}`} onClick={() => { setDeleteError(null); setPendingDelete({ kind: 'meal', id: meal.id, title: meal.title }); }}>Remove</button>}
            </div>}
          </li>;
        })}</ul>
        <p className="dwp-total">{incompleteCalories ? 'Known calories' : 'Day total'} <strong>{totalCalories} kcal</strong></p>
      </>}
    </section>}

    {pendingDelete && <div className="dwp-delete" role="alert">
      <p>Remove “{pendingDelete.title}”?</p>
      {deleteError && <p>{deleteError}</p>}
      <button type="button" disabled={deleting} onClick={() => setPendingDelete(null)}>Cancel</button>
      <button type="button" disabled={deleting} onClick={() => void confirmDelete()}>{deleting ? 'Removing…' : 'Confirm removal'}</button>
    </div>}
    {actions?.updateTripDetails && <TripDetailsSheet isOpen={detailsOpen} trip={trip!}
      latestPlannedDay={getLatestPlannedDay(timeline, meals)} onClose={() => setDetailsOpen(false)} onSubmit={actions.updateTripDetails} />}
    {(actions?.addTimelineEvent || actions?.updateTimelineEvent) && <TimelineFormSheet isOpen={eventEditor !== null}
      initialEvent={eventEditor?.item} defaultDay={day} tripDays={dayCount} nextSortOrder={nextSortOrder}
      onClose={() => setEventEditor(null)} onSubmit={async value => {
        if (eventEditor?.item) await actions.updateTimelineEvent(eventEditor.item.id, value);
        else await actions.addTimelineEvent(value);
      }} />}
    {(actions?.addMeal || actions?.updateMeal) && <MealFormSheet isOpen={mealEditor !== null}
      initialMeal={mealEditor?.item} defaultDay={day} totalDays={dayCount} crew={crew}
      onClose={() => setMealEditor(null)} onSubmit={async value => {
        if (mealEditor?.item) await actions.updateMeal(mealEditor.item.id, value);
        else await actions.addMeal(value);
      }} />}
  </>;
}

export default function DesktopWorkspacePlanSection({ navigationPath }: { navigationPath: string }) {
  const workspace = useTripWorkspace();
  const draftGuard = useOptionalTripDraftGuard();
  const [selectedDayState, setSelectedDay] = useState(1);
  if (!workspace.data || !workspace.trip) return null;
  const dayCount = Math.max(workspace.tripDays, 1);
  const selectedDay = Math.min(Math.max(selectedDayState, 1), dayCount);
  return <section className="desktop-workspace-plan" data-plan-composition="compact-desktop" aria-labelledby="desktop-plan-title">
    <header className="dwp-heading"><h2 id="desktop-plan-title" tabIndex={-1}>Plan</h2><p>Day {selectedDay} of {dayCount}</p></header>
    <div className="dwp-days" role="group" aria-label="Trip days">
      {Array.from({ length: dayCount }, (_, i) => i + 1).map(day => <button key={day} type="button"
        aria-pressed={day === selectedDay} onClick={() => {
          if (draftGuard) void draftGuard.requestAction(() => setSelectedDay(day));
          else setSelectedDay(day);
        }}>Day {day}</button>)}
    </div>
    <PlanDay key={`${navigationPath}:${selectedDay}`} workspace={workspace} day={selectedDay} dayCount={dayCount} />
  </section>;
}
