'use client';

import React from 'react';
import MapRouteCard from '@/components/cards/MapRouteCard';
import WeatherCard from '@/components/cards/WeatherCard';
import { useTripWorkspace } from '@/components/trip/TripWorkspaceProvider';
import PriorityAlertCard from './PriorityAlertCard';
import ReadinessSummaryCard from './ReadinessSummaryCard';
import TodaySummaryCard from './TodaySummaryCard';
import TripHero from './TripHero';
import TripSituationRail from './TripSituationRail';
import {
  getHomeScheduleSummary,
  getPriorityAlert,
  getVisibleAlerts,
} from './homeSelectors';

const mobileHomeOrderQuery = '(max-width: 767px)';

function subscribeToMobileHomeOrder(onChange: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};

  const query = window.matchMedia(mobileHomeOrderQuery);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function getMobileHomeOrderSnapshot() {
  return typeof window !== 'undefined' &&
    Boolean(window.matchMedia) &&
    window.matchMedia(mobileHomeOrderQuery).matches;
}

export default function HomeOverview() {
  const {
    data,
    trip,
    timeline,
    alerts,
    tripDays,
    countdown,
    readiness,
    editableActions,
  } = useTripWorkspace();
  const usesMobileHomeOrder = React.useSyncExternalStore(
    subscribeToMobileHomeOrder,
    getMobileHomeOrderSnapshot,
    () => false
  );

  if (!data || !trip || !countdown || !readiness) return null;

  const base = `/trips/${encodeURIComponent(trip.id)}`;
  const schedule = getHomeScheduleSummary({
    trip,
    tripDays,
    timeline,
  });
  const visibleAlerts = getVisibleAlerts(alerts);
  const priorityAlert = getPriorityAlert(visibleAlerts);

  const modules = {
    map: (
      <div key="map" className="home-map" data-home-module="map">
        <MapRouteCard
          trip={trip}
          onSaveLocation={editableActions?.saveCampsite}
          variant="home"
        />
      </div>
    ),
    weather: (
      <section
        key="weather"
        className="home-weather"
        data-home-module="weather"
        aria-label="Weather and forecast"
      >
        <WeatherCard
          tripId={trip.id}
          weather={data.currentWeather}
          weatherRefresh={data.weatherRefresh}
          astro={data.astro}
          forecast={data.forecast}
          variant="home"
        />
      </section>
    ),
    readiness: (
      <div key="readiness" className="home-readiness" data-home-module="readiness">
        <ReadinessSummaryCard
          readiness={readiness}
          href={`${base}/gear`}
          showMeals={data.settings.show_meals}
          showOffline={data.settings.show_offline}
        />
      </div>
    ),
    today: (
      <div key="today" className="home-today" data-home-module="day-plan">
        <TodaySummaryCard summary={schedule} href={`${base}/plan`} />
      </div>
    ),
    priority: (
      <div key="priority" className="home-priority" data-home-module="priority-notice">
        <PriorityAlertCard alert={priorityAlert} href={`${base}/guide`} />
      </div>
    ),
  };

  const operationalModules = usesMobileHomeOrder
    ? [modules.today, modules.priority, modules.map, modules.weather, modules.readiness]
    : [modules.map, modules.weather, modules.readiness, modules.today, modules.priority];

  return (
    <div className="home-overview">
      <div className="home-heading-region">
        <TripHero trip={trip} />
        <TripSituationRail
          weather={data.currentWeather}
          readiness={readiness}
          schedule={schedule}
        />
      </div>

      <div className="home-primary-grid" data-home-grid="operational">
        {operationalModules}
      </div>
    </div>
  );
}
