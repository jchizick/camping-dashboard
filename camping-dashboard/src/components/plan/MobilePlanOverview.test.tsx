// @vitest-environment jsdom

import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CrewMember, Meal, TimelineEvent, TripDashboard } from '@/types';
import MobilePlanOverview from './MobilePlanOverview';

vi.mock('next/dynamic', () => ({
  default: () => () => null,
}));

const trip = {
  id: 'trip-1',
  name: 'Maple Lake Weekend',
  park_name: 'Algonquin Park',
  lake_name: 'Maple Lake',
  site_name: 'Site 4',
  start_date: '2026-08-01',
  end_date: '2026-08-03',
  map_style: null,
  theme_mode: null,
  campsite_latitude: 45.1,
  campsite_longitude: -78.2,
  campsite_label: 'Maple Lake Site 4',
  campsite_source: 'manual_map_selection',
  campsite_osm_id: null,
} as TripDashboard;

function event(overrides: Partial<TimelineEvent> = {}): TimelineEvent {
  return {
    id: 'event-1',
    trip_id: 'trip-1',
    day_number: 1,
    event_time: '09:00',
    title: 'Launch canoes',
    details: 'Meet at the access point.',
    sort_order: 10,
    phase: null,
    ...overrides,
  };
}

function meal(overrides: Partial<Meal> = {}): Meal {
  return {
    id: 'meal-1',
    trip_id: 'trip-1',
    day_number: 1,
    meal_type: 'breakfast',
    prep_type: 'fresh',
    title: 'Oatmeal',
    notes: 'Add berries',
    calories: 600,
    assigned_to: '',
    prep_crew_member_id: null,
    ...overrides,
  } as Meal;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('MobilePlanOverview', () => {
  it('uses one day selector for itinerary and meals', () => {
    render(
      <MobilePlanOverview
        trip={trip}
        timeline={[
          event(),
          event({
            id: 'event-2',
            day_number: 2,
            title: 'Make camp',
            phase: 'Setup',
          }),
        ]}
        meals={[
          meal(),
          meal({ id: 'meal-2', day_number: 2, title: 'Trail wraps', calories: 700 }),
        ]}
        tripDays={3}
        showMeals
      />
    );

    const selector = screen.getByRole('group', { name: 'Trip days' });
    expect(within(selector).getAllByRole('button')).toHaveLength(3);
    expect(screen.getByText('Launch canoes')).toBeTruthy();
    expect(screen.getByText('Oatmeal')).toBeTruthy();

    fireEvent.click(within(selector).getByRole('button', { name: /Day 2/ }));

    expect(screen.getByText('Make camp')).toBeTruthy();
    expect(screen.getByText('Trail wraps')).toBeTruthy();
    expect(screen.queryByText('Launch canoes')).toBeNull();
    expect(screen.queryByText('Oatmeal')).toBeNull();
    expect(screen.getByText('Setup')).toBeTruthy();
    expect(screen.queryByText('Uncategorized')).toBeNull();
    expect(screen.getAllByText('700 kcal')).toHaveLength(2);
  });

  it('keeps duplicate meal slots visible without changing readiness semantics', () => {
    render(
      <MobilePlanOverview
        trip={trip}
        timeline={[]}
        meals={[
          meal({ id: 'breakfast-1', title: 'Oatmeal', calories: 500 }),
          meal({ id: 'breakfast-2', title: 'Coffee stop', calories: 200 }),
        ]}
        tripDays={3}
        showMeals
      />
    );

    expect(screen.getAllByText('Breakfast')).toHaveLength(2);
    expect(screen.getByText('Oatmeal')).toBeTruthy();
    expect(screen.getByText('Coffee stop')).toBeTruthy();
    expect(screen.getByText('700 kcal')).toBeTruthy();
  });

  it('presents a restrained meal prep lead resolved by Crew ID', () => {
    const crew = [{
      id: 'crew-liz', trip_id: 'trip-1', trip_member_id: null, name: 'Liz',
      role: 'Food lead', load_item: '', load_weight_kg: 0, canoe_number: 1, notes: '',
    }] satisfies CrewMember[];
    render(
      <MobilePlanOverview
        trip={trip} timeline={[]} meals={[meal({ prep_crew_member_id: 'crew-liz' })]}
        crew={crew} tripDays={3} showMeals
      />
    );

    expect(screen.getByText('Prep · Liz')).toBeTruthy();
  });

  it('defaults new itinerary and meal entries to the shared selected day', async () => {
    const onAddEvent = vi.fn().mockResolvedValue(undefined);
    const onAddMeal = vi.fn().mockResolvedValue(undefined);
    render(
      <MobilePlanOverview
        trip={trip}
        timeline={[]}
        meals={[]}
        tripDays={3}
        showMeals
        onAddEvent={onAddEvent}
        onAddMeal={onAddMeal}
      />
    );

    const selector = screen.getByRole('group', { name: 'Trip days' });
    fireEvent.click(within(selector).getByRole('button', { name: /Day 2/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Add itinerary event' }));
    fireEvent.change(screen.getByLabelText('Title *'), {
      target: { value: 'Morning paddle' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add Event' }));

    await waitFor(() => {
      expect(onAddEvent).toHaveBeenCalledWith(
        expect.objectContaining({ day_number: 2, title: 'Morning paddle' })
      );
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Add meal' })[0]);
    fireEvent.change(screen.getByLabelText('Title *'), {
      target: { value: 'Shore lunch' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add Meal' }));

    await waitFor(() => {
      expect(onAddMeal).toHaveBeenCalledWith(
        expect.objectContaining({ day_number: 2, title: 'Shore lunch' })
      );
    });
  });

  it('preserves mobile edit and delete flows', async () => {
    const onUpdateEvent = vi.fn().mockResolvedValue(undefined);
    const onDeleteEvent = vi.fn().mockResolvedValue(undefined);
    const onUpdateMeal = vi.fn().mockResolvedValue(undefined);
    const onDeleteMeal = vi.fn().mockResolvedValue(undefined);
    render(
      <MobilePlanOverview
        trip={trip}
        timeline={[event()]}
        meals={[meal()]}
        tripDays={3}
        showMeals
        onUpdateEvent={onUpdateEvent}
        onDeleteEvent={onDeleteEvent}
        onUpdateMeal={onUpdateMeal}
        onDeleteMeal={onDeleteMeal}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit Launch canoes' }));
    fireEvent.change(screen.getByLabelText('Title *'), {
      target: { value: 'Launch early' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(onUpdateEvent).toHaveBeenCalledWith(
      'event-1',
      expect.objectContaining({ title: 'Launch early' })
    ));

    fireEvent.click(screen.getByRole('button', { name: 'Remove Launch canoes' }));
    fireEvent.click(within(screen.getByText('Remove this event?').parentElement!).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(onDeleteEvent).toHaveBeenCalledWith('event-1'));

    fireEvent.click(screen.getByRole('button', { name: 'Edit Oatmeal' }));
    fireEvent.change(screen.getByLabelText('Title *'), {
      target: { value: 'Granola' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(onUpdateMeal).toHaveBeenCalledWith(
      'meal-1',
      expect.objectContaining({ title: 'Granola' })
    ));

    fireEvent.click(screen.getByRole('button', { name: 'Remove Oatmeal' }));
    fireEvent.click(within(screen.getByText('Remove this meal?').parentElement!).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(onDeleteMeal).toHaveBeenCalledWith('meal-1'));
  });

  it('renders quiet empty states for a day with no plans', () => {
    render(
      <MobilePlanOverview
        trip={trip}
        timeline={[]}
        meals={[]}
        tripDays={3}
        showMeals
      />
    );

    expect(screen.getByText('No itinerary items yet.')).toBeTruthy();
    expect(screen.getByText('No meals planned for this day.')).toBeTruthy();
  });
});
