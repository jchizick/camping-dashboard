// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CrewMember, Meal } from '@/types';
import MealFormSheet from './MealFormSheet';

const crew = [{
  id: 'crew-liz', trip_id: 'trip-1', trip_member_id: null, name: 'Liz',
  role: 'Food lead', load_item: '', load_weight_kg: 0, canoe_number: 2, notes: '',
}] satisfies CrewMember[];

const meal: Meal = {
  id: 'meal-1', trip_id: 'trip-1', day_number: 1, meal_type: 'dinner',
  title: 'Chili', prep_type: 'fresh', calories: 700, assigned_to: 'Old Liz',
  prep_crew_member_id: null, notes: '',
};

describe('MealFormSheet prep responsibility', () => {
  afterEach(cleanup);

  it('preserves unresolved legacy text until a Crew ID selection replaces it', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <MealFormSheet
        isOpen onClose={() => {}} onSubmit={onSubmit} initialMeal={meal}
        totalDays={3} crew={crew}
      />
    );

    expect(screen.getByText(/Legacy assignment: Old Liz/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Prep lead'), { target: { value: 'crew-liz' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      prep_crew_member_id: 'crew-liz', assigned_to: null,
    });
  });

  it('allows explicit unassignment', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <MealFormSheet
        isOpen onClose={() => {}} onSubmit={onSubmit}
        initialMeal={{ ...meal, assigned_to: null, prep_crew_member_id: 'crew-liz' }}
        totalDays={3} crew={crew}
      />
    );

    fireEvent.change(screen.getByLabelText('Prep lead'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(onSubmit.mock.calls[0][0].prep_crew_member_id).toBeNull());
  });

  it('does not re-write legacy assignment text beside an authoritative Crew ID', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<MealFormSheet isOpen onClose={() => {}} onSubmit={onSubmit} initialMeal={{ ...meal, prep_crew_member_id: 'crew-liz' }} totalDays={3} crew={crew} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(onSubmit.mock.calls[0][0].assigned_to).toBeNull());
  });
});
