import { describe, expect, it } from 'vitest';
import type { CrewMember, GearItem, Meal } from '@/types';
import {
  getCrewGear,
  getCrewMeals,
  getCrewSelectOptions,
  getUnassignedRequiredGear,
  resolveCrewResponsibility,
} from './crewResponsibility';

const crew = [
  {
    id: 'crew-jordan-lead', trip_id: 'trip', trip_member_id: null,
    name: 'Jordan', role: 'Lead', load_item: 'Tent', load_weight_kg: 12,
    canoe_number: 1, notes: '',
  },
  {
    id: 'crew-jordan-paddler', trip_id: 'trip', trip_member_id: null,
    name: ' jordan ', role: 'Paddler', load_item: '', load_weight_kg: 9,
    canoe_number: 2, notes: '',
  },
] satisfies CrewMember[];

const gear = [
  {
    id: 'tent', trip_id: 'trip', name: 'Tent', category: 'Shelter', packed: false,
    owner: null, responsible_crew_member_id: 'crew-jordan-lead', priority: 'critical',
    notes: '', weight_kg: 2, acquired: true,
  },
  {
    id: 'map', trip_id: 'trip', name: 'Map', category: 'Navigation', packed: false,
    owner: null, responsible_crew_member_id: null, priority: 'critical', notes: '',
    weight_kg: 0, acquired: true,
  },
] satisfies GearItem[];

const meals = [{
  id: 'meal', trip_id: 'trip', day_number: 1, meal_type: 'dinner', title: 'Chili',
  prep_type: 'fresh', calories: 600, assigned_to: null,
  prep_crew_member_id: 'crew-jordan-lead', notes: '',
}] satisfies Meal[];

describe('Crew responsibility view model', () => {
  it('uses stable IDs and disambiguates duplicate names with role and canoe', () => {
    expect(getCrewSelectOptions(crew)).toEqual([
      { id: 'crew-jordan-lead', label: 'Jordan — Lead · Canoe 1' },
      { id: 'crew-jordan-paddler', label: ' jordan  — Paddler · Canoe 2' },
    ]);
  });

  it('resolves renamed Crew by ID and labels unresolved legacy text clearly', () => {
    expect(resolveCrewResponsibility('crew-jordan-lead', 'Old Jordan', crew).label).toBe('Jordan');
    expect(resolveCrewResponsibility(null, 'Old Jordan', crew)).toMatchObject({
      kind: 'legacy', label: 'Legacy assignment · Old Jordan',
    });
  });

  it('groups responsibilities by Crew ID and finds unassigned required Gear', () => {
    expect(getCrewGear('crew-jordan-lead', gear).map((item) => item.id)).toEqual(['tent']);
    expect(getCrewMeals('crew-jordan-lead', meals).map((meal) => meal.id)).toEqual(['meal']);
    expect(getUnassignedRequiredGear(gear).map((item) => item.id)).toEqual(['map']);
  });
});
