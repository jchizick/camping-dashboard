import { describe, expect, it } from 'vitest';
import type {
  Alert,
  GearItem,
  Meal,
  OfflineStatus,
  TimelineEvent,
  WeatherCurrent,
  WeatherForecast,
} from '@/types';
import {
  evaluateGearCategory,
  evaluateMealsCategory,
  evaluateReadiness,
  evaluateTimelineCategory,
  getReadinessStatus,
  type EvaluateReadinessInput,
} from './index';

function gearItem(overrides: Partial<GearItem> = {}): GearItem {
  return {
    id: 'gear-1',
    trip_id: 'trip-1',
    name: 'Tent',
    category: 'Shelter',
    acquired: false,
    packed: false,
    owner: null,
    priority: 'critical',
    notes: null,
    weight_kg: null,
    ...overrides,
  } as GearItem;
}

function meal(overrides: Partial<Meal> = {}): Meal {
  return {
    id: 'meal-1',
    trip_id: 'trip-1',
    day_number: 1,
    meal_type: 'breakfast',
    title: 'Oatmeal',
    assigned_to: null,
    calories: null,
    notes: null,
    prep_type: 'fresh',
    ...overrides,
  } as Meal;
}

function offlineStatus(overrides: Partial<OfflineStatus> = {}): OfflineStatus {
  return {
    trip_id: 'trip-1',
    maps_cached: false,
    permit_saved: false,
    daily_vehicle_permit_saved: false,
    route_downloaded: false,
    satellite_device_connected: false,
    satellite_device_name: null,
    emergency_contact_ready: false,
    updated_at: null,
    ...overrides,
  } as OfflineStatus;
}

function weather(overrides: Partial<WeatherCurrent> = {}): WeatherCurrent {
  return {
    trip_id: 'trip-1',
    temperature_c: 18,
    condition_label: 'Clear',
    icon: 'clear',
    rain_chance: 0,
    wind_kph: 5,
    updated_at: '2026-08-24T00:00:00Z',
    ...overrides,
  } as WeatherCurrent;
}

function forecast(overrides: Partial<WeatherForecast> = {}): WeatherForecast {
  return {
    id: 'forecast-1',
    trip_id: 'trip-1',
    forecast_date: '2026-08-25',
    condition_label: 'Clear',
    icon: 'clear',
    rain_chance: 0,
    wind_kph: 5,
    ...overrides,
  } as WeatherForecast;
}

function readinessInput(
  overrides: Partial<EvaluateReadinessInput> = {}
): EvaluateReadinessInput {
  return {
    tripId: 'trip-1',
    tripDays: 1,
    gear: [gearItem({ acquired: true, packed: true })],
    meals: [],
    timeline: [],
    currentWeather: null,
    forecast: [],
    offlineStatus: null,
    modules: {
      mealsEnabled: false,
      offlineEnabled: false,
    },
    alerts: [],
    ...overrides,
  };
}

function completeMeals(): Meal[] {
  return [
    meal({ id: 'breakfast', meal_type: 'breakfast' }),
    meal({ id: 'lunch', meal_type: 'lunch' }),
    meal({ id: 'dinner', meal_type: 'dinner' }),
  ];
}

describe('readiness availability and weighting', () => {
  it('excludes missing weather and unavailable optional data instead of scoring zero', () => {
    const result = evaluateReadiness(
      readinessInput({
        gear: [],
        modules: { mealsEnabled: false, offlineEnabled: true },
      })
    );

    expect(result.score).toBeNull();
    expect(result.status).toBe('unavailable');
    expect(result.categories.weather.availability).toBe('unavailable');
    expect(result.categories.offline.availability).toBe('unavailable');
    expect(Number.isNaN(result.score)).toBe(false);
  });

  it('does not let disabled modules reduce readiness', () => {
    const result = evaluateReadiness(readinessInput());

    expect(result.score).toBe(100);
    expect(result.categories.meals.availability).toBe('excluded');
    expect(result.categories.offline.availability).toBe('excluded');
  });

  it('normalizes the remaining applicable category weights', () => {
    const result = evaluateReadiness(
      readinessInput({
        meals: [meal()],
        modules: { mealsEnabled: true, offlineEnabled: false },
      })
    );

    expect(result.categories.gear.normalizedWeight).toBeCloseTo(35 / 55);
    expect(result.categories.meals.normalizedWeight).toBeCloseTo(20 / 55);
    expect(result.categories.weather.normalizedWeight).toBe(0);
    expect(result.score).toBe(76);
  });
});

describe('gear readiness semantics', () => {
  it('creates a blocker when a critical item is not acquired', () => {
    const result = evaluateReadiness(
      readinessInput({ gear: [gearItem({ acquired: false, packed: false })] })
    );

    expect(result.categories.gear.score).toBe(0);
    expect(result.blockers).toHaveLength(1);
    expect(result.blockers[0].title).toContain('not acquired');
  });

  it('creates a warning when a critical item is acquired but not packed', () => {
    const result = evaluateReadiness(
      readinessInput({ gear: [gearItem({ acquired: true, packed: false })] })
    );

    expect(result.categories.gear.score).toBe(50);
    expect(result.blockers).toHaveLength(0);
    expect(result.warnings[0].title).toContain('not packed');
  });

  it('resolves critical issues once the item is packed', () => {
    const result = evaluateReadiness(readinessInput());

    expect(result.categories.gear.score).toBe(100);
    expect(result.blockers).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('does not score or create issues for missing optional gear', () => {
    const result = evaluateReadiness(
      readinessInput({
        gear: [gearItem({ priority: 'low', acquired: false, packed: false })],
      })
    );

    expect(result.categories.gear.score).toBeNull();
    expect(result.categories.gear.availability).toBe('unavailable');
    expect(result.blockers).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('keeps Gear unavailable when all optional items are packed', () => {
    const category = evaluateGearCategory([
      gearItem({ priority: 'high', acquired: true, packed: true }),
    ]);

    expect(category.score).toBeNull();
    expect(category.availability).toBe('unavailable');
  });

  it('does not let unpacked optional items reduce a packed critical score', () => {
    const category = evaluateGearCategory([
      gearItem({ id: 'required', acquired: true, packed: true }),
      gearItem({ id: 'chair', priority: 'low', acquired: false, packed: false }),
      gearItem({ id: 'book', priority: 'high', acquired: true, packed: false }),
      gearItem({ id: 'hammock', priority: 'low', acquired: false, packed: false }),
    ]);

    expect(category.score).toBe(100);
    expect(category.issues).toHaveLength(0);
  });

  it('keeps the same score when unpacked optional gear is added or removed', () => {
    const required = gearItem({ id: 'required', acquired: true, packed: false });
    const optional = gearItem({
      id: 'optional',
      priority: 'low',
      acquired: false,
      packed: false,
    });

    expect(evaluateGearCategory([required]).score).toBe(50);
    expect(evaluateGearCategory([required, optional]).score).toBe(50);
  });

  it('keeps an empty gear list unavailable and non-scoring', () => {
    const category = evaluateGearCategory([]);

    expect(category.score).toBeNull();
    expect(category.availability).toBe('unavailable');
    expect(category.issues).toHaveLength(0);
  });

  it('normalizes other category weights when optional-only Gear is non-scoring', () => {
    const result = evaluateReadiness(
      readinessInput({
        gear: [gearItem({ priority: 'low', acquired: false, packed: false })],
        meals: [meal()],
        modules: { mealsEnabled: true, offlineEnabled: false },
      })
    );

    expect(result.categories.gear.normalizedWeight).toBe(0);
    expect(result.categories.meals.normalizedWeight).toBe(1);
    expect(result.score).toBe(33);
    expect(Number.isNaN(result.score)).toBe(false);
  });
});

describe('meal readiness semantics', () => {
  it('counts unique intended slots so duplicate rows cannot inflate completeness', () => {
    const category = evaluateMealsCategory(
      [
        meal({ id: 'breakfast-1' }),
        meal({ id: 'breakfast-2' }),
        meal({ id: 'breakfast-3' }),
      ],
      1,
      true
    );

    expect(category.score).toBe(33);
  });

  it('caps meal readiness at 100', () => {
    const category = evaluateMealsCategory(
      [
        meal({ id: 'breakfast-1', meal_type: 'breakfast' }),
        meal({ id: 'breakfast-2', meal_type: 'breakfast' }),
        meal({ id: 'lunch', meal_type: 'lunch' }),
        meal({ id: 'dinner', meal_type: 'dinner' }),
      ],
      1,
      true
    );

    expect(category.score).toBe(100);
  });

  it('excludes Meals when the module is disabled', () => {
    const category = evaluateMealsCategory([meal()], 1, false);

    expect(category.score).toBeNull();
    expect(category.availability).toBe('excluded');
  });
});

describe('informational conditions and timeline signals', () => {
  it('does not use arbitrary raw event count as itinerary completeness', () => {
    const events = Array.from({ length: 40 }, (_, index) => ({
      id: `event-${index}`,
    })) as TimelineEvent[];
    const category = evaluateTimelineCategory(events);

    expect(category.score).toBeNull();
    expect(category.availability).toBe('informational');
  });

  it.each([
    ['rain', weather({ rain_chance: 100 }), [forecast({ rain_chance: 100 })]],
    ['wind', weather({ wind_kph: 80 }), [forecast({ wind_kph: 90 })]],
    ['favourable conditions', weather(), [forecast()]],
  ])('does not let %s award or subtract preparedness', (_label, current, entries) => {
    const result = evaluateReadiness(
      readinessInput({ currentWeather: current, forecast: entries })
    );

    expect(result.score).toBe(100);
    expect(result.categories.weather.score).toBeNull();
    expect(result.categories.weather.availability).toBe('informational');
  });

  it('does not lower readiness when weather is missing', () => {
    expect(evaluateReadiness(readinessInput()).score).toBe(100);
  });
});

describe('canonical readiness status', () => {
  it.each([
    [49, 'not-ready'],
    [50, 'needs-attention'],
    [74, 'needs-attention'],
    [75, 'nearly-ready'],
    [89, 'nearly-ready'],
    [90, 'locked-in'],
  ] as const)('maps %i to %s', (score, status) => {
    expect(getReadinessStatus(score)).toBe(status);
  });
});

describe('assessment coverage guard', () => {
  it('is complete when critical Gear is scored even if other categories are unavailable, excluded, or informational', () => {
    const result = evaluateReadiness(
      readinessInput({
        gear: [gearItem({ acquired: true, packed: false })],
        currentWeather: weather(),
        modules: { mealsEnabled: false, offlineEnabled: true },
      })
    );

    expect(result.assessmentCoverage).toBe('complete');
    expect(result.coverageIssues).toHaveLength(0);
    expect(result.score).toBe(50);
    expect(result.status).toBe('needs-attention');
  });

  it('keeps a numeric score but marks coverage partial when no Gear exists', () => {
    const result = evaluateReadiness(
      readinessInput({
        gear: [],
        meals: completeMeals(),
        modules: { mealsEnabled: true, offlineEnabled: false },
      })
    );

    expect(result.score).toBe(100);
    expect(result.scoreStatus).toBe('locked-in');
    expect(result.assessmentCoverage).toBe('partial');
    expect(result.status).toBe('assessment-incomplete');
    expect(result.statusLabel).toBe('Readiness Incomplete');
    expect(result.coverageIssues).toEqual([
      {
        id: 'coverage:gear:required-gear-not-identified',
        category: 'gear',
        reason: 'required-gear-not-identified',
        action: {
          label: 'Review gear',
          destination: 'gear',
          href: '/trips/trip-1/gear',
        },
      },
    ]);
  });

  it('does not present a partial optional-only assessment as Nearly Ready', () => {
    const result = evaluateReadiness(
      readinessInput({
        gear: [gearItem({ priority: 'low' })],
        meals: completeMeals(),
        offlineStatus: offlineStatus({
          maps_cached: true,
          permit_saved: true,
          daily_vehicle_permit_saved: true,
          route_downloaded: true,
        }),
        modules: { mealsEnabled: true, offlineEnabled: true },
      })
    );

    expect(result.score).toBe(84);
    expect(result.scoreStatus).toBe('nearly-ready');
    expect(result.assessmentCoverage).toBe('partial');
    expect(result.status).toBe('assessment-incomplete');
  });

  it('stays partial when all optional Gear is packed', () => {
    const result = evaluateReadiness(
      readinessInput({
        gear: [
          gearItem({ id: 'chair', priority: 'low', acquired: true, packed: true }),
          gearItem({ id: 'hammock', priority: 'high', acquired: true, packed: true }),
        ],
        meals: completeMeals(),
        modules: { mealsEnabled: true, offlineEnabled: false },
      })
    );

    expect(result.categories.gear.score).toBeNull();
    expect(result.score).toBe(100);
    expect(result.assessmentCoverage).toBe('partial');
    expect(result.status).toBe('assessment-incomplete');
  });

  it('uses normal Locked In semantics when critical Gear is packed', () => {
    const result = evaluateReadiness(readinessInput());

    expect(result.score).toBe(100);
    expect(result.scoreStatus).toBe('locked-in');
    expect(result.assessmentCoverage).toBe('complete');
    expect(result.status).toBe('locked-in');
    expect(result.statusLabel).toBe('Locked In');
  });

  it('marks coverage unavailable when no category can be scored', () => {
    const result = evaluateReadiness(
      readinessInput({
        gear: [],
        modules: { mealsEnabled: false, offlineEnabled: false },
      })
    );

    expect(result.score).toBeNull();
    expect(result.scoreStatus).toBe('unavailable');
    expect(result.assessmentCoverage).toBe('unavailable');
    expect(result.status).toBe('unavailable');
  });

  it('keeps coverage complete and creates a blocker when critical Gear is missing', () => {
    const result = evaluateReadiness(
      readinessInput({ gear: [gearItem({ acquired: false, packed: false })] })
    );

    expect(result.score).toBe(0);
    expect(result.assessmentCoverage).toBe('complete');
    expect(result.blockers).toHaveLength(1);
    expect(result.status).toBe('not-ready');
  });

  it('keeps coverage issues separate from readiness priority', () => {
    const result = evaluateReadiness(
      readinessInput({
        gear: [gearItem({ priority: 'low' })],
        meals: [],
        modules: { mealsEnabled: true, offlineEnabled: false },
      })
    );

    expect(result.assessmentCoverage).toBe('partial');
    expect(result.coverageIssues).toHaveLength(1);
    expect(result.blockers).toHaveLength(0);
    expect(result.warnings.map((issue) => issue.category)).toEqual(['meals']);
    expect(result.primaryPriority?.id).toBe('meals:incomplete-slots');
    expect(result.nextAction?.destination).toBe('plan');
    expect(result.status).toBe('not-ready');
  });
});

describe('readiness issue priority and actions', () => {
  it('ranks blockers before warnings with deterministic tie-breaking', () => {
    const result = evaluateReadiness(
      readinessInput({
        gear: [
          gearItem({ id: 'z-item', name: 'Z item' }),
          gearItem({ id: 'a-item', name: 'A item' }),
        ],
        meals: [],
        modules: { mealsEnabled: true, offlineEnabled: false },
      })
    );

    expect(result.primaryPriority?.id).toBe('gear:a-item:not-acquired');
    expect(result.primaryPriority?.severity).toBe('blocker');
    expect(result.nextAction).toEqual({
      label: 'Review gear',
      destination: 'gear',
      href: '/trips/trip-1/gear',
    });
  });

  it('does not convert a critical external alert into readiness priority', () => {
    const alert = {
      id: 'alert-1',
      trip_id: 'trip-1',
      title: 'Park closure',
      severity: 'critical',
      is_active: true,
    } as Alert;
    const result = evaluateReadiness(readinessInput({ alerts: [alert] }));

    expect(result.notices.activeCount).toBe(1);
    expect(result.primaryPriority).toBeNull();
  });

  it('maps meal and manual-prep priorities to existing Plan and Field routes', () => {
    const mealsPriority = evaluateReadiness(
      readinessInput({
        gear: [gearItem({ priority: 'low', acquired: true, packed: true })],
        modules: { mealsEnabled: true, offlineEnabled: false },
      })
    );
    const offlinePriority = evaluateReadiness(
      readinessInput({
        offlineStatus: offlineStatus(),
        modules: { mealsEnabled: false, offlineEnabled: true },
      })
    );

    expect(mealsPriority.nextAction).toEqual({
      label: 'Plan meals',
      destination: 'plan',
      href: '/trips/trip-1/plan',
    });
    expect(offlinePriority.nextAction).toEqual({
      label: 'Review field preparation',
      destination: 'field',
      href: '/trips/trip-1/guide',
    });
  });
});

describe('readiness score safety', () => {
  it('never exceeds 100 or falls below 0', () => {
    const complete = evaluateReadiness(
      readinessInput({
        offlineStatus: offlineStatus({
          maps_cached: true,
          permit_saved: true,
          daily_vehicle_permit_saved: true,
          route_downloaded: true,
          satellite_device_connected: true,
          emergency_contact_ready: true,
        }),
        modules: { mealsEnabled: false, offlineEnabled: true },
      })
    );
    const incomplete = evaluateReadiness(
      readinessInput({ gear: [gearItem()], modules: { mealsEnabled: true, offlineEnabled: false } })
    );

    expect(complete.score).toBe(100);
    expect(incomplete.score).toBeGreaterThanOrEqual(0);
    expect(incomplete.score).toBeLessThanOrEqual(100);
    expect(Number.isNaN(incomplete.score)).toBe(false);
  });
});
