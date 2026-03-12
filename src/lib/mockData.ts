// ============================================================
// Camping Dashboard — Mock Data (Single Source of Truth)
// Used for MVP: replace with Supabase data fetching in Phase 2
// DO NOT import this inside card components
// ============================================================

import type {
    Trip,
    WeatherCurrent,
    WeatherForecast,
    GearItem,
    TimelineEvent,
    Meal,
    CrewMember,
    ParkIntel,
    OfflineStatus,
    AstroData,
    Alert,
    Settings,
    DashboardData,
} from '@/types';

const TRIP_ID = 'trip-maple-lake-001';

// ─── Trip ─────────────────────────────────────────────────
export const mockTrip: Trip = {
    id: TRIP_ID,
    name: 'Algonquin Trip',
    park_name: 'Algonquin Provincial Park',
    lake_name: 'Maple Leaf Lake',
    site_name: 'Site 4',
    start_date: '2026-07-10',
    end_date: '2026-07-14',
    launch_point_name: 'Western Uplands Backpacking Trail',
    launch_lat: 45.46337,
    launch_lng: -78.79792,
    site_lat: 45.468,
    site_lng: -78.83503,
    distance_km: 8.5,
    notes: 'Canoe-in only. Check fire restrictions before departure. Reserve portage route B.',
    theme_mode: 'auto',
    created_at: '2026-03-06T00:00:00Z',
    updated_at: '2026-03-06T00:00:00Z',
};

// ─── Current Weather ──────────────────────────────────────
export const mockWeatherCurrent: WeatherCurrent = {
    id: 'wc-001',
    trip_id: TRIP_ID,
    temperature_c: 22,
    wind_kph: 14,
    humidity: 68,
    rain_chance: 20,
    sunset_time: '20:52',
    sunrise_time: '05:45',
    moonset_time: '02:17',
    moonrise_time: '15:44',
    condition_label: 'Partly Cloudy',
    icon: '⛅',
    updated_at: '2026-03-06T10:00:00Z',
};

// ─── Weather Forecast ─────────────────────────────────────
export const mockForecast: WeatherForecast[] = [
    {
        id: 'wf-001',
        trip_id: TRIP_ID,
        forecast_date: '2026-07-10',
        high_c: 24,
        low_c: 13,
        condition_label: 'Partly Cloudy',
        rain_chance: 20,
        wind_kph: 14,
        icon: '⛅',
    },
    {
        id: 'wf-002',
        trip_id: TRIP_ID,
        forecast_date: '2026-07-11',
        high_c: 26,
        low_c: 14,
        condition_label: 'Mostly Sunny',
        rain_chance: 5,
        wind_kph: 10,
        icon: '☀️',
    },
    {
        id: 'wf-003',
        trip_id: TRIP_ID,
        forecast_date: '2026-07-12',
        high_c: 19,
        low_c: 12,
        condition_label: 'Thunderstorm Risk',
        rain_chance: 65,
        wind_kph: 28,
        icon: '⛈️',
    },
    {
        id: 'wf-004',
        trip_id: TRIP_ID,
        forecast_date: '2026-07-13',
        high_c: 22,
        low_c: 11,
        condition_label: 'Clearing',
        rain_chance: 25,
        wind_kph: 16,
        icon: '🌤️',
    },
    {
        id: 'wf-005',
        trip_id: TRIP_ID,
        forecast_date: '2026-07-14',
        high_c: 23,
        low_c: 12,
        condition_label: 'Clear',
        rain_chance: 10,
        wind_kph: 12,
        icon: '☀️',
    },
];

// ─── Gear Items ───────────────────────────────────────────
export const mockGear: GearItem[] = [
    // Shelter
    { id: 'g-001', trip_id: TRIP_ID, name: 'Tent (2p)', category: 'Shelter', packed: true, owner: 'Jordan', priority: 'critical', notes: 'Footprint inside bag', weight_kg: 1.8 },
    { id: 'g-002', trip_id: TRIP_ID, name: 'Sleeping Bag (Jordan)', category: 'Shelter', packed: true, owner: 'Jordan', priority: 'critical', notes: '5°C rating', weight_kg: 0.9 },
    { id: 'g-003', trip_id: TRIP_ID, name: 'Sleeping Bag (Alex)', category: 'Shelter', packed: true, owner: 'Alex', priority: 'critical', notes: '5°C rating', weight_kg: 0.9 },
    { id: 'g-004', trip_id: TRIP_ID, name: 'Sleeping Pad (Jordan)', category: 'Shelter', packed: true, owner: 'Jordan', priority: 'high', notes: 'R3.5 foam', weight_kg: 0.5 },
    { id: 'g-005', trip_id: TRIP_ID, name: 'Sleeping Pad (Alex)', category: 'Shelter', packed: false, owner: 'Alex', priority: 'high', notes: 'Confirm inflation valve', weight_kg: 0.5 },
    // Navigation
    { id: 'g-006', trip_id: TRIP_ID, name: 'Topographic Map', category: 'Navigation', packed: true, owner: 'Jordan', priority: 'critical', notes: 'Laminated — Algonquin W sector', weight_kg: 0.1 },
    { id: 'g-007', trip_id: TRIP_ID, name: 'Compass', category: 'Navigation', packed: true, owner: 'Jordan', priority: 'critical', notes: '', weight_kg: 0.05 },
    { id: 'g-008', trip_id: TRIP_ID, name: 'Garmin inReach Mini', category: 'Navigation', packed: false, owner: 'Jordan', priority: 'critical', notes: 'Needs charging before departure', weight_kg: 0.1 },
    // Paddling
    { id: 'g-009', trip_id: TRIP_ID, name: 'Canoe (17ft Kevlar)', category: 'Paddling', packed: true, owner: 'Shared', priority: 'critical', notes: 'Roof rack secured', weight_kg: 16 },
    { id: 'g-010', trip_id: TRIP_ID, name: 'Paddle (Jordan)', category: 'Paddling', packed: true, owner: 'Jordan', priority: 'critical', notes: 'Carbon bent shaft', weight_kg: 0.4 },
    { id: 'g-011', trip_id: TRIP_ID, name: 'Paddle (Alex)', category: 'Paddling', packed: true, owner: 'Alex', priority: 'critical', notes: '', weight_kg: 0.6 },
    { id: 'g-012', trip_id: TRIP_ID, name: 'PFD (Jordan)', category: 'Paddling', packed: true, owner: 'Jordan', priority: 'critical', notes: 'MEC Hydrus', weight_kg: 0.7 },
    { id: 'g-013', trip_id: TRIP_ID, name: 'PFD (Alex)', category: 'Paddling', packed: true, owner: 'Alex', priority: 'critical', notes: '', weight_kg: 0.7 },
    { id: 'g-014', trip_id: TRIP_ID, name: 'Dry Bags (60L x2)', category: 'Paddling', packed: true, owner: 'Shared', priority: 'high', notes: '', weight_kg: 0.4 },
    // Cooking
    { id: 'g-015', trip_id: TRIP_ID, name: 'MSR PocketRocket Stove', category: 'Cooking', packed: true, owner: 'Jordan', priority: 'high', notes: '', weight_kg: 0.07 },
    { id: 'g-016', trip_id: TRIP_ID, name: 'Fuel Canisters (x2)', category: 'Cooking', packed: true, owner: 'Jordan', priority: 'high', notes: '225g each', weight_kg: 0.45 },
    { id: 'g-017', trip_id: TRIP_ID, name: 'Cook Pot (1.5L)', category: 'Cooking', packed: true, owner: 'Shared', priority: 'high', notes: '', weight_kg: 0.3 },
    { id: 'g-018', trip_id: TRIP_ID, name: 'Sporks (x2)', category: 'Cooking', packed: true, owner: 'Shared', priority: 'low', notes: '', weight_kg: 0.04 },
    { id: 'g-019', trip_id: TRIP_ID, name: 'Water Filter (Sawyer Squeeze)', category: 'Cooking', packed: false, owner: 'Alex', priority: 'critical', notes: 'Backflush before packing', weight_kg: 0.08 },
    // Safety
    { id: 'g-020', trip_id: TRIP_ID, name: 'First Aid Kit', category: 'Safety', packed: true, owner: 'Alex', priority: 'critical', notes: 'Check expiry on meds', weight_kg: 0.4 },
    { id: 'g-021', trip_id: TRIP_ID, name: 'Rope (10m paracord)', category: 'Safety', packed: true, owner: 'Shared', priority: 'high', notes: '', weight_kg: 0.2 },
    { id: 'g-022', trip_id: TRIP_ID, name: 'Whistle', category: 'Safety', packed: true, owner: 'Shared', priority: 'critical', notes: 'Attached to each PFD', weight_kg: 0.02 },
    // Clothing
    { id: 'g-023', trip_id: TRIP_ID, name: 'Rain Jacket (Jordan)', category: 'Clothing', packed: true, owner: 'Jordan', priority: 'critical', notes: '', weight_kg: 0.35 },
    { id: 'g-024', trip_id: TRIP_ID, name: 'Rain Jacket (Alex)', category: 'Clothing', packed: false, owner: 'Alex', priority: 'critical', notes: 'Check seam tape', weight_kg: 0.35 },
    { id: 'g-025', trip_id: TRIP_ID, name: 'Headlamp (x2)', category: 'Lighting', packed: true, owner: 'Shared', priority: 'high', notes: 'Fresh batteries loaded', weight_kg: 0.16 },
    // Camp
    { id: 'g-026', trip_id: TRIP_ID, name: 'Bear Cache / Food Bag', category: 'Camp', packed: true, owner: 'Shared', priority: 'critical', notes: 'OPP regulations require use', weight_kg: 0.5 },
    { id: 'g-027', trip_id: TRIP_ID, name: 'Park Permit', category: 'Admin', packed: false, owner: 'Jordan', priority: 'critical', notes: 'Print + digital backup', weight_kg: 0 },
];

// ─── Timeline Events ──────────────────────────────────────
export const mockTimeline: TimelineEvent[] = [
    // Day 1 — Travel & Launch
    { id: 't-001', trip_id: TRIP_ID, day_number: 1, event_time: '06:30', title: 'Depart Home', details: 'Load canoe, double-check dry bags. ETA to Rain Lake: ~4h.', sort_order: 1 },
    { id: 't-002', trip_id: TRIP_ID, day_number: 1, event_time: '10:30', title: 'Arrive Rain Lake Access', details: 'Register at kiosk. Unload gear. Self-pay permit station on site.', sort_order: 2 },
    { id: 't-003', trip_id: TRIP_ID, day_number: 1, event_time: '11:00', title: 'Launch — Rain Lake', details: 'Paddle east toward Maple Lake portage. ~3km open water.', sort_order: 3 },
    { id: 't-004', trip_id: TRIP_ID, day_number: 1, event_time: '12:30', title: 'Portage — 520m', details: 'Carry to Maple Lake. Two trips recommended with full load.', sort_order: 4 },
    { id: 't-005', trip_id: TRIP_ID, day_number: 1, event_time: '14:00', title: 'Arrive Site 4 — Maple Lake', details: 'Set up tent before 15:00. Hang food cache. Explore site perimeter.', sort_order: 5 },
    { id: 't-006', trip_id: TRIP_ID, day_number: 1, event_time: '19:00', title: 'Campfire Dinner', details: 'Dehydrated meal. Check fire restriction status.', sort_order: 6 },
    { id: 't-007', trip_id: TRIP_ID, day_number: 1, event_time: '20:52', title: 'Sunset / Golden Hour', details: 'Paddles for the western shore view.', sort_order: 7 },
    // Day 2 — Exploration
    { id: 't-008', trip_id: TRIP_ID, day_number: 2, event_time: '07:00', title: 'Sunrise Coffee', details: 'Sunrise at 05:45. Slow morning.', sort_order: 1 },
    { id: 't-009', trip_id: TRIP_ID, day_number: 2, event_time: '09:00', title: 'Day Paddle — North Shore', details: 'Lightweight gear. Explore rocky point at north end. Watch for loons.', sort_order: 2 },
    { id: 't-010', trip_id: TRIP_ID, day_number: 2, event_time: '13:00', title: 'Shore Lunch', details: 'Pita + almond butter + energy bars. Filter water.', sort_order: 3 },
    { id: 't-011', trip_id: TRIP_ID, day_number: 2, event_time: '18:30', title: 'Dinner + Campfire', details: 'Thai peanut noodles. Collect firewood before dark.', sort_order: 4 },
    { id: 't-012', trip_id: TRIP_ID, day_number: 2, event_time: '22:00', title: 'Stargazing', details: 'Waxing gibbous — core not visible but good for constellation ID.', sort_order: 5 },
    // Day 3 — Weather Watch
    { id: 't-013', trip_id: TRIP_ID, day_number: 3, event_time: '08:00', title: 'Monitor Weather', details: 'High storm risk. Stay near camp. Read, rest, swim if clear.', sort_order: 1 },
    { id: 't-014', trip_id: TRIP_ID, day_number: 3, event_time: '12:00', title: 'Shelter Prep', details: 'If storms develop: stake extra guylines, stow loose gear.', sort_order: 2 },
    { id: 't-015', trip_id: TRIP_ID, day_number: 3, event_time: '18:00', title: 'Camp Dinner', details: 'Lentil soup + crackers.', sort_order: 3 },
    // Day 4 — Paddle Out
    { id: 't-016', trip_id: TRIP_ID, day_number: 4, event_time: '07:30', title: 'Break Camp', details: 'Leave no trace. Douse firepit completely. Bury waste.', sort_order: 1 },
    { id: 't-017', trip_id: TRIP_ID, day_number: 4, event_time: '09:00', title: 'Paddle Out', details: 'Retrace route via portage. Aim to reach Rain Lake by 11:30.', sort_order: 2 },
    { id: 't-018', trip_id: TRIP_ID, day_number: 4, event_time: '12:00', title: 'Load & Depart', details: 'Canoe on roof, gear packed. Drive home.', sort_order: 3 },
];

// ─── Meals ────────────────────────────────────────────────
export const mockMeals: Meal[] = [
    // Day 1
    { id: 'm-001', trip_id: TRIP_ID, day_number: 1, meal_type: 'breakfast', title: 'Drive-Through / Packed', prep_type: 'fresh', calories: 600, assigned_to: 'Shared', notes: 'Eat before launching' },
    { id: 'm-002', trip_id: TRIP_ID, day_number: 1, meal_type: 'lunch', title: 'Trail Mix + Energy Bars', prep_type: 'fresh', calories: 500, assigned_to: 'Shared', notes: 'Eat on water' },
    { id: 'm-003', trip_id: TRIP_ID, day_number: 1, meal_type: 'dinner', title: 'Backcountry Pasta Bolognese', prep_type: 'dehydrated', calories: 720, assigned_to: 'Jordan', notes: 'Just Add Water x2 servings' },
    // Day 2
    { id: 'm-004', trip_id: TRIP_ID, day_number: 2, meal_type: 'breakfast', title: 'Oatmeal + Blueberries + Coffee', prep_type: 'dehydrated', calories: 480, assigned_to: 'Alex', notes: 'Instant oats + dried blueberries' },
    { id: 'm-005', trip_id: TRIP_ID, day_number: 2, meal_type: 'lunch', title: 'Pita + Almond Butter + Banana Chips', prep_type: 'fresh', calories: 520, assigned_to: 'Shared', notes: '' },
    { id: 'm-006', trip_id: TRIP_ID, day_number: 2, meal_type: 'dinner', title: 'Thai Peanut Noodles', prep_type: 'dehydrated', calories: 680, assigned_to: 'Jordan', notes: 'Add olive oil packet for calories' },
    { id: 'm-007', trip_id: TRIP_ID, day_number: 2, meal_type: 'snack', title: 'Dark Chocolate + Nuts', prep_type: 'fresh', calories: 280, assigned_to: 'Shared', notes: '' },
    // Day 3
    { id: 'm-008', trip_id: TRIP_ID, day_number: 3, meal_type: 'breakfast', title: 'Scrambled Eggs + Hash (freeze-dried)', prep_type: 'dehydrated', calories: 540, assigned_to: 'Alex', notes: '' },
    { id: 'm-009', trip_id: TRIP_ID, day_number: 3, meal_type: 'lunch', title: 'Crackers + Tuna Packets', prep_type: 'fresh', calories: 460, assigned_to: 'Shared', notes: 'Foil packs — lightweight' },
    { id: 'm-010', trip_id: TRIP_ID, day_number: 3, meal_type: 'dinner', title: 'Red Lentil Soup + Flatbread', prep_type: 'fire', calories: 600, assigned_to: 'Jordan', notes: 'Cook over fire if restriction allows' },
    // Day 4
    { id: 'm-011', trip_id: TRIP_ID, day_number: 4, meal_type: 'breakfast', title: 'Granola + Milk Powder', prep_type: 'dehydrated', calories: 450, assigned_to: 'Alex', notes: 'Eat before breaking camp' },
    { id: 'm-012', trip_id: TRIP_ID, day_number: 4, meal_type: 'lunch', title: 'Stop in Town', prep_type: 'fresh', calories: 700, assigned_to: 'Shared', notes: 'Earned it.' },
];

// ─── Crew Members ─────────────────────────────────────────
export const mockCrew: CrewMember[] = [
    { id: 'c-001', trip_id: TRIP_ID, name: 'Jordan', role: 'Stern Paddler / Navigator', load_item: 'Canoe + Tent + Cook Kit', load_weight_kg: 22, canoe_number: 1, notes: 'Portage lead' },
    { id: 'c-002', trip_id: TRIP_ID, name: 'Alex', role: 'Bow Paddler / Medic', load_item: 'Food Pack + First Aid + Filter', load_weight_kg: 18, canoe_number: 1, notes: 'Water filtering duty' },
];

// ─── Park Intel ───────────────────────────────────────────
export const mockParkIntel: ParkIntel = {
    id: 'pi-001',
    trip_id: TRIP_ID,
    fire_restriction: 'Level 1 — Campfires permitted in established rings only',
    wildlife_notes: 'Black bear activity reported on northern shore of Maple Lake. Hang all food + scented items at least 4m high, 1m from trunk. Moose frequently spotted near marshy inlets. Maintain 100m distance.',
    ranger_station: 'Rain Lake Access: (705) 633-5572',
    firewood_percent: 70,
    water_notes: 'Maple Lake water is potable after filtration. No algal bloom advisory as of last update.',
    custom_notes: 'Site 4 has a stone fire ring and bear cache post on-site. Dock is usable but rickety — approach cautiously.',
    updated_at: '2026-03-06T10:00:00Z',
};

// ─── Offline Status ───────────────────────────────────────
export const mockOfflineStatus: OfflineStatus = {
    id: 'os-001',
    trip_id: TRIP_ID,
    maps_cached: true,
    permit_saved: false,
    route_downloaded: true,
    satellite_device_connected: false,
    satellite_device_name: 'Garmin inReach Mini 2',
    emergency_contact_ready: true,
    updated_at: '2026-03-06T10:00:00Z',
};

// ─── Astro Data ───────────────────────────────────────────
export const mockAstro: AstroData = {
    id: 'a-001',
    trip_id: TRIP_ID,
    golden_hour_start: '19:45',
    golden_hour_end: '20:35',
    blue_hour_end: '21:10',
    moon_phase: 'Waxing Gibbous',
    moon_illumination: 78,
    milky_way_visibility: 'Moderate — Moon obscures faint core but bright stars visible',
    stargazing_notes: 'Excellent dark sky zone. Algonquin Park is low light pollution. Best viewing after 23:00 when moon sets. Perseus and Scorpius prominent in July.',
    updated_at: '2026-03-06T10:00:00Z',
};

// ─── Alerts ───────────────────────────────────────────────
export const mockAlerts: Alert[] = [
    {
        id: 'al-001',
        trip_id: TRIP_ID,
        title: 'Thunderstorm Risk — Day 3',
        body: 'Environment Canada forecasts a 65% chance of severe thunderstorms on July 12. Secure camp by 14:00. Avoid open water during storm window (14:00–18:00).',
        severity: 'warning',
        source: 'Environment Canada',
        is_active: true,
        created_at: '2026-03-06T10:00:00Z',
    },
    {
        id: 'al-002',
        trip_id: TRIP_ID,
        title: 'Bear Activity — North Shore',
        body: 'Park staff logged a black bear near the north Maple Lake shore in the past 7 days. Follow food storage protocols at all times.',
        severity: 'warning',
        source: 'Algonquin Park Ranger',
        is_active: true,
        created_at: '2026-03-06T10:00:00Z',
    },
    {
        id: 'al-003',
        trip_id: TRIP_ID,
        title: 'Permit Not Yet Saved',
        body: 'Interior camping permit has not been downloaded for offline access. Save before your trip.',
        severity: 'info',
        source: 'Offline Vault',
        is_active: true,
        created_at: '2026-03-06T10:00:00Z',
    },
    {
        id: 'al-004',
        trip_id: TRIP_ID,
        title: 'Satellite Device Not Connected',
        body: 'Garmin inReach Mini 2 has not been linked. Confirm device is charged and subscription active.',
        severity: 'critical',
        source: 'Safety Check',
        is_active: true,
        created_at: '2026-03-06T10:00:00Z',
    },
];

// ─── Settings ─────────────────────────────────────────────
export const mockSettings: Settings = {
    id: 'set-001',
    trip_id: TRIP_ID,
    manual_theme_override: 'auto',
    preferred_units: 'metric',
    show_astro: true,
    show_meals: true,
    show_offline: true,
    show_crew: true,
};

// ─── Full Dashboard Payload ───────────────────────────────
export const mockDashboardData: DashboardData = {
    trip: mockTrip,
    currentWeather: mockWeatherCurrent,
    forecast: mockForecast,
    gear: mockGear,
    timeline: mockTimeline,
    meals: mockMeals,
    crew: mockCrew,
    parkIntel: mockParkIntel,
    offlineStatus: mockOfflineStatus,
    astro: mockAstro,
    alerts: mockAlerts,
    settings: mockSettings,
};
