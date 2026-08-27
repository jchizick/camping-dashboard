import type {
  Alert,
  GearItem,
  Meal,
  OfflineStatus,
  TimelineEvent,
  WeatherCurrent,
  WeatherForecast,
} from '@/types';

export const READINESS_CATEGORY_WEIGHTS = {
  gear: 35,
  meals: 20,
  offline: 20,
  weather: 0,
  timeline: 0,
  crew: 0,
} as const;

export type ReadinessCategoryKey = keyof typeof READINESS_CATEGORY_WEIGHTS;
export type ReadinessIssueSeverity = 'blocker' | 'warning';
export type ReadinessCategoryAvailability =
  | 'scored'
  | 'informational'
  | 'unavailable'
  | 'excluded';
export type ReadinessAssessmentCoverage = 'complete' | 'partial' | 'unavailable';
export type ReadinessCoverageReason = 'required-gear-not-identified';
export type ReadinessScoreStatus =
  | 'locked-in'
  | 'nearly-ready'
  | 'needs-attention'
  | 'not-ready'
  | 'unavailable';
export type ReadinessStatus = ReadinessScoreStatus | 'assessment-incomplete';
export type ReadinessDestination = 'gear' | 'plan' | 'field';

export interface ReadinessAction {
  label: string;
  destination: ReadinessDestination;
  href: string;
}

export interface ReadinessIssue {
  id: string;
  severity: ReadinessIssueSeverity;
  category: ReadinessCategoryKey;
  impact: number;
  title: string;
  description: string;
  action: ReadinessAction | null;
}

export interface ReadinessCoverageIssue {
  id: string;
  category: 'gear';
  reason: ReadinessCoverageReason;
  action: ReadinessAction | null;
}

export interface ReadinessCategoryResult {
  key: ReadinessCategoryKey;
  label: string;
  score: number | null;
  weight: number;
  normalizedWeight: number;
  applicable: boolean;
  availability: ReadinessCategoryAvailability;
  explanation: string;
  issues: ReadinessIssue[];
}

export interface ReadinessConditions {
  availability: 'available' | 'unavailable';
  currentCondition: string | null;
  maxRainChance: number | null;
  maxWindKph: number | null;
}

export interface ReadinessResult {
  score: number | null;
  scoreStatus: ReadinessScoreStatus;
  assessmentCoverage: ReadinessAssessmentCoverage;
  coverageIssues: ReadinessCoverageIssue[];
  status: ReadinessStatus;
  statusLabel: string;
  categories: Record<ReadinessCategoryKey, ReadinessCategoryResult>;
  blockers: ReadinessIssue[];
  warnings: ReadinessIssue[];
  primaryPriority: ReadinessIssue | null;
  nextAction: ReadinessAction | null;
  conditions: ReadinessConditions;
  notices: {
    activeCount: number;
  };
}

export interface EvaluateReadinessInput {
  tripId: string;
  tripDays: number;
  gear: readonly GearItem[];
  meals: readonly Meal[];
  timeline: readonly TimelineEvent[];
  currentWeather: WeatherCurrent | null;
  forecast: readonly WeatherForecast[];
  offlineStatus: OfflineStatus | null;
  modules: {
    mealsEnabled: boolean;
    offlineEnabled: boolean;
  };
  alerts?: readonly Alert[];
}

export const READINESS_STATUS_LABELS: Record<ReadinessStatus, string> = {
  'locked-in': 'Locked In',
  'nearly-ready': 'Nearly Ready',
  'needs-attention': 'Needs Attention',
  'not-ready': 'Not Ready',
  unavailable: 'Readiness Unavailable',
  'assessment-incomplete': 'Readiness Incomplete',
};

const CATEGORY_LABELS: Record<ReadinessCategoryKey, string> = {
  gear: 'Gear',
  meals: 'Meals',
  offline: 'Manual Prep',
  weather: 'Conditions',
  timeline: 'Timeline',
  crew: 'Crew',
};

const CATEGORY_PRIORITY: Record<ReadinessCategoryKey, number> = {
  gear: 0,
  meals: 1,
  offline: 2,
  timeline: 3,
  weather: 4,
  crew: 5,
};

function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.min(100, Math.max(0, Math.round(score)));
}

export function getReadinessStatus(score: number | null): ReadinessScoreStatus {
  if (score === null) return 'unavailable';
  if (score >= 90) return 'locked-in';
  if (score >= 75) return 'nearly-ready';
  if (score >= 50) return 'needs-attention';
  return 'not-ready';
}

function actionFor(
  tripId: string | null,
  destination: ReadinessDestination,
  label: string
): ReadinessAction | null {
  if (!tripId) return null;
  const segment = destination === 'field' ? 'guide' : destination;
  return {
    label,
    destination,
    href: `/trips/${encodeURIComponent(tripId)}/${segment}`,
  };
}

function categoryResult(
  key: ReadinessCategoryKey,
  values: Omit<
    ReadinessCategoryResult,
    'key' | 'label' | 'weight' | 'normalizedWeight'
  >
): ReadinessCategoryResult {
  return {
    key,
    label: CATEGORY_LABELS[key],
    weight: READINESS_CATEGORY_WEIGHTS[key],
    normalizedWeight: 0,
    ...values,
  };
}

function gearItemScore(item: GearItem): number {
  if (item.packed) return 100;
  if (item.acquired) return 50;
  return 0;
}

export function evaluateGearCategory(
  gear: readonly GearItem[],
  tripId: string | null = null
): ReadinessCategoryResult {
  if (gear.length === 0) {
    return categoryResult('gear', {
      score: null,
      applicable: true,
      availability: 'unavailable',
      explanation: 'No trip gear has been added, so gear readiness is not scored.',
      issues: [],
    });
  }

  const criticalItems = gear.filter((item) => item.priority === 'critical');
  if (criticalItems.length === 0) {
    return categoryResult('gear', {
      score: null,
      applicable: true,
      availability: 'unavailable',
      explanation:
        'No critical gear is identified, so optional packing state is not scored as readiness.',
      issues: [],
    });
  }

  const score = clampScore(
    criticalItems.reduce((total, item) => total + gearItemScore(item), 0) /
      criticalItems.length
  );
  const issues = criticalItems
    .flatMap<ReadinessIssue>((item) => {
      if (item.packed) return [];
      if (!item.acquired) {
        return [
          {
            id: `gear:${item.id}:not-acquired`,
            severity: 'blocker',
            category: 'gear',
            impact: 100,
            title: `${item.name} is not acquired`,
            description: `This critical trip item is not available and still needs to be acquired.`,
            action: actionFor(tripId, 'gear', 'Review gear'),
          },
        ];
      }
      return [
        {
          id: `gear:${item.id}:not-packed`,
          severity: 'warning',
          category: 'gear',
          impact: 90,
          title: `${item.name} is not packed`,
          description: `This critical trip item is available but has not been packed.`,
          action: actionFor(tripId, 'gear', 'Pack critical gear'),
        },
      ];
    })
    .toSorted((left, right) => left.id.localeCompare(right.id));

  return categoryResult('gear', {
    score,
    applicable: true,
    availability: 'scored',
    explanation:
      'Only critical gear is scored; optional gear remains packing information.',
    issues,
  });
}

const SCORED_MEAL_TYPES = new Set(['breakfast', 'lunch', 'dinner']);

export function evaluateMealsCategory(
  meals: readonly Meal[],
  totalDays: number,
  enabled: boolean,
  tripId: string | null = null
): ReadinessCategoryResult {
  if (!enabled) {
    return categoryResult('meals', {
      score: null,
      applicable: false,
      availability: 'excluded',
      explanation: 'Meals are disabled for this trip and are excluded from readiness.',
      issues: [],
    });
  }
  if (!Number.isInteger(totalDays) || totalDays <= 0) {
    return categoryResult('meals', {
      score: null,
      applicable: true,
      availability: 'unavailable',
      explanation: 'Trip duration is unavailable, so expected meal slots cannot be determined.',
      issues: [],
    });
  }

  const expectedSlots = totalDays * SCORED_MEAL_TYPES.size;
  const plannedSlots = new Set(
    meals.flatMap((meal) => {
      const day = meal.day_number;
      if (
        !Number.isInteger(day) ||
        day === null ||
        day < 1 ||
        day > totalDays ||
        !SCORED_MEAL_TYPES.has(meal.meal_type)
      ) {
        return [];
      }
      return [`${day}:${meal.meal_type}`];
    })
  ).size;
  const score = clampScore((plannedSlots / expectedSlots) * 100);
  const issues: ReadinessIssue[] =
    score < 100
      ? [
          {
            id: 'meals:incomplete-slots',
            severity: 'warning',
            category: 'meals',
            impact: 100 - score,
            title: 'Meal plan has open slots',
            description: `${plannedSlots} of ${expectedSlots} breakfast, lunch, and dinner slots are planned.`,
            action: actionFor(tripId, 'plan', 'Plan meals'),
          },
        ]
      : [];

  return categoryResult('meals', {
    score,
    applicable: true,
    availability: 'scored',
    explanation: `${plannedSlots} unique meal slots are planned out of ${expectedSlots}.`,
    issues,
  });
}

const OFFLINE_CHECKS = [
  'maps_cached',
  'permit_saved',
  'daily_vehicle_permit_saved',
  'route_downloaded',
  'satellite_device_connected',
  'emergency_contact_ready',
] as const satisfies readonly (keyof OfflineStatus)[];

export function evaluateOfflineCategory(
  status: OfflineStatus | null,
  enabled: boolean,
  tripId: string | null = null
): ReadinessCategoryResult {
  if (!enabled) {
    return categoryResult('offline', {
      score: null,
      applicable: false,
      availability: 'excluded',
      explanation: 'Manual offline preparation is disabled and excluded from readiness.',
      issues: [],
    });
  }
  if (!status) {
    return categoryResult('offline', {
      score: null,
      applicable: true,
      availability: 'unavailable',
      explanation: 'The manual preparation checklist has not been configured.',
      issues: [],
    });
  }

  const completed = OFFLINE_CHECKS.filter((key) => Boolean(status[key])).length;
  const score = clampScore((completed / OFFLINE_CHECKS.length) * 100);
  const issues: ReadinessIssue[] =
    score < 100
      ? [
          {
            id: 'offline:incomplete-checklist',
            severity: 'warning',
            category: 'offline',
            impact: 100 - score,
            title: 'Manual field preparation is incomplete',
            description: `${completed} of ${OFFLINE_CHECKS.length} manual preparation checks are complete.`,
            action: actionFor(tripId, 'field', 'Review field preparation'),
          },
        ]
      : [];

  return categoryResult('offline', {
    score,
    applicable: true,
    availability: 'scored',
    explanation: `${completed} of ${OFFLINE_CHECKS.length} manual preparation checks are complete.`,
    issues,
  });
}

function finiteValues(values: readonly (number | null | undefined)[]): number[] {
  return values.filter(
    (value): value is number => typeof value === 'number' && Number.isFinite(value)
  );
}

export function evaluateWeatherCategory(
  weather: WeatherCurrent | null,
  forecast: readonly WeatherForecast[]
): { category: ReadinessCategoryResult; conditions: ReadinessConditions } {
  const rainValues = finiteValues([
    weather?.rain_chance,
    ...forecast.map((entry) => entry.rain_chance),
  ]);
  const windValues = finiteValues([
    weather?.wind_kph,
    ...forecast.map((entry) => entry.wind_kph),
  ]);
  const available = weather !== null || forecast.length > 0;
  const conditions: ReadinessConditions = {
    availability: available ? 'available' : 'unavailable',
    currentCondition: weather?.condition_label ?? null,
    maxRainChance: rainValues.length > 0 ? Math.max(...rainValues) : null,
    maxWindKph: windValues.length > 0 ? Math.max(...windValues) : null,
  };

  return {
    conditions,
    category: categoryResult('weather', {
      score: null,
      applicable: true,
      availability: available ? 'informational' : 'unavailable',
      explanation: available
        ? 'Weather describes trip conditions and does not award or subtract readiness points.'
        : 'Weather conditions are unavailable and do not reduce readiness.',
      issues: [],
    }),
  };
}

export function evaluateTimelineCategory(
  events: readonly TimelineEvent[]
): ReadinessCategoryResult {
  return categoryResult('timeline', {
    score: null,
    applicable: true,
    availability: events.length > 0 ? 'informational' : 'unavailable',
    explanation:
      events.length > 0
        ? `${events.length} timeline event${events.length === 1 ? '' : 's'} recorded; event count is informational, not a readiness score.`
        : 'No timeline events are available; no arbitrary completeness score is inferred.',
    issues: [],
  });
}

function evaluateCrewCategory(): ReadinessCategoryResult {
  return categoryResult('crew', {
    score: null,
    applicable: false,
    availability: 'excluded',
    explanation: 'Crew readiness is excluded until membership and planning identities are unified.',
    issues: [],
  });
}

function compareIssues(left: ReadinessIssue, right: ReadinessIssue): number {
  const severityDifference =
    (left.severity === 'blocker' ? 0 : 1) -
    (right.severity === 'blocker' ? 0 : 1);
  if (severityDifference !== 0) return severityDifference;

  const impactDifference = right.impact - left.impact;
  if (impactDifference !== 0) return impactDifference;

  const categoryDifference =
    CATEGORY_PRIORITY[left.category] - CATEGORY_PRIORITY[right.category];
  if (categoryDifference !== 0) return categoryDifference;

  return left.id.localeCompare(right.id);
}

export function evaluateReadiness(input: EvaluateReadinessInput): ReadinessResult {
  const gear = evaluateGearCategory(input.gear, input.tripId);
  const meals = evaluateMealsCategory(
    input.meals,
    input.tripDays,
    input.modules.mealsEnabled,
    input.tripId
  );
  const offline = evaluateOfflineCategory(
    input.offlineStatus,
    input.modules.offlineEnabled,
    input.tripId
  );
  const weatherResult = evaluateWeatherCategory(
    input.currentWeather,
    input.forecast
  );
  const timeline = evaluateTimelineCategory(input.timeline);
  const crew = evaluateCrewCategory();
  const categories: ReadinessResult['categories'] = {
    gear,
    meals,
    offline,
    weather: weatherResult.category,
    timeline,
    crew,
  };

  const scoredCategories = Object.values(categories).filter(
    (category) => category.availability === 'scored' && category.score !== null
  );
  const applicableWeight = scoredCategories.reduce(
    (total, category) => total + category.weight,
    0
  );
  for (const category of scoredCategories) {
    category.normalizedWeight =
      applicableWeight > 0 ? category.weight / applicableWeight : 0;
  }

  const score =
    applicableWeight > 0
      ? clampScore(
          scoredCategories.reduce(
            (total, category) =>
              total + (category.score ?? 0) * category.normalizedWeight,
            0
          )
        )
      : null;
  const scoreStatus = getReadinessStatus(score);
  const assessmentCoverage: ReadinessAssessmentCoverage =
    score === null
      ? 'unavailable'
      : gear.availability === 'scored'
        ? 'complete'
        : 'partial';
  const coverageIssues: ReadinessCoverageIssue[] =
    assessmentCoverage === 'partial'
      ? [
          {
            id: 'coverage:gear:required-gear-not-identified',
            category: 'gear',
            reason: 'required-gear-not-identified',
            action: actionFor(input.tripId, 'gear', 'Review gear'),
          },
        ]
      : [];
  const status: ReadinessStatus =
    assessmentCoverage === 'partial' &&
    (scoreStatus === 'locked-in' || scoreStatus === 'nearly-ready')
      ? 'assessment-incomplete'
      : scoreStatus;
  const issues = Object.values(categories)
    .flatMap((category) => category.issues)
    .toSorted(compareIssues);
  const blockers = issues.filter((issue) => issue.severity === 'blocker');
  const warnings = issues.filter((issue) => issue.severity === 'warning');
  const primaryPriority = issues[0] ?? null;

  return {
    score,
    scoreStatus,
    assessmentCoverage,
    coverageIssues,
    status,
    statusLabel: READINESS_STATUS_LABELS[status],
    categories,
    blockers,
    warnings,
    primaryPriority,
    nextAction: primaryPriority?.action ?? null,
    conditions: weatherResult.conditions,
    notices: {
      activeCount: input.alerts?.filter((alert) => alert.is_active).length ?? 0,
    },
  };
}
