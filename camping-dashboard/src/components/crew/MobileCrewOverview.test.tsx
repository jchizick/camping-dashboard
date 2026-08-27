// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CrewMember, GearItem, Meal } from '@/types';
import MobileCrewOverview from './MobileCrewOverview';

const member: CrewMember = {
  id: 'crew-1', trip_id: 'trip-1', trip_member_id: null, name: 'Jordan',
  role: 'Navigator', load_item: 'Route system', load_weight_kg: 12,
  canoe_number: 1, notes: 'Keeps the route card close.',
};

const gear: GearItem[] = [
  {
    id: 'tent', trip_id: 'trip-1', name: 'Tent', category: 'Shelter', acquired: true,
    packed: false, owner: null, responsible_crew_member_id: 'crew-1', priority: 'critical',
    notes: '', weight_kg: 2.4,
  },
  {
    id: 'map', trip_id: 'trip-1', name: 'Map', category: 'Navigation', acquired: true,
    packed: true, owner: null, responsible_crew_member_id: null, priority: 'critical',
    notes: '', weight_kg: 0.1,
  },
];

const meals: Meal[] = [{
  id: 'meal-1', trip_id: 'trip-1', day_number: 2, meal_type: 'dinner',
  title: 'Chili', prep_type: 'fresh', calories: 700, assigned_to: null,
  prep_crew_member_id: 'crew-1', notes: '',
}];

describe('MobileCrewOverview', () => {
  afterEach(cleanup);

  it('puts participant Gear and Meal responsibilities ahead of secondary load details', () => {
    const { container } = render(<MobileCrewOverview crew={[member]} gear={gear} meals={meals} />);
    const person = screen.getByRole('article');

    expect(within(person).getByRole('heading', { name: 'Gear' })).toBeTruthy();
    expect(within(person).getByText('Tent')).toBeTruthy();
    expect(within(person).getByRole('heading', { name: 'Meal prep' })).toBeTruthy();
    expect(within(person).getByText('Chili')).toBeTruthy();
    expect(screen.getByText('1 Required Gear item has no Crew owner')).toBeTruthy();
    expect(screen.getByText('Assign responsibilities when planning with others.')).toBeTruthy();
    expect(container.querySelector('details')?.textContent).toContain('Assigned systems');
  });

  it('reports affected relationship counts before Crew deletion', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(
      <MobileCrewOverview crew={[member]} gear={gear} meals={meals} onDelete={onDelete} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remove Jordan' }));
    expect(screen.getByRole('alert').textContent).toContain(
      '1 Gear item and 1 meal will become unassigned'
    );
    fireEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('crew-1'));
  });

  it('updates visible responsibility ownership when the same Crew ID is renamed', () => {
    const view = render(<MobileCrewOverview crew={[member]} gear={gear} meals={meals} />);
    expect(screen.getByRole('heading', { name: 'Jordan' })).toBeTruthy();

    view.rerender(
      <MobileCrewOverview crew={[{ ...member, name: 'Jordan C.' }]} gear={gear} meals={meals} />
    );
    expect(screen.getByRole('heading', { name: 'Jordan C.' })).toBeTruthy();
    expect(screen.getByText('Tent')).toBeTruthy();
    expect(screen.getByText('Chili')).toBeTruthy();
  });

  it('keeps unassigned Required Gear explicitly optional for solo campers', () => {
    render(<MobileCrewOverview crew={[]} gear={[gear[1]]} meals={[]} />);

    expect(screen.getByText('1 Required Gear item has no Crew owner')).toBeTruthy();
    expect(screen.getByText('Travelling solo? Crew assignments are optional.')).toBeTruthy();
    expect(screen.queryByText(/needs an accountable person/i)).toBeNull();
  });

  it('keeps the truly empty no-Crew state simple when there are no responsibilities', () => {
    render(<MobileCrewOverview crew={[]} gear={[]} meals={[]} />);

    expect(screen.getByRole('heading', { name: 'No participants yet' })).toBeTruthy();
    expect(screen.queryByText('Optional coordination')).toBeNull();
  });
});
