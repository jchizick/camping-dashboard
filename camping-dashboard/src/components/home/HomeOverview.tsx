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
import TripSectionLinks from './TripSectionLinks';
import {
  getHomeScheduleSummary,
  getPriorityAlert,
  getVisibleAlerts,
} from './homeSelectors';

export default function HomeOverview() {
  const {
    data,
    trip,
    gear,
    meals,
    timeline,
    crew,
    alerts,
    offlineStatus,
    parkIntel,
    prepFeed,
    tripDays,
    countdown,
    readiness,
    editableActions,
  } = useTripWorkspace();

  if (!data || !trip || !countdown || !readiness) return null;

  const base = `/trips/${encodeURIComponent(trip.id)}`;
  const schedule = getHomeScheduleSummary({
    trip,
    tripDays,
    timeline,
  });
  const visibleAlerts = getVisibleAlerts(alerts);
  const priorityAlert = getPriorityAlert(visibleAlerts);

  return (
    <div className="home-overview">
      <div className="home-heading-region">
        <TripHero trip={trip} tripDays={tripDays} />
        <TripSituationRail
          weather={data.currentWeather}
          readiness={readiness}
          schedule={schedule}
        />
      </div>

      <div className="home-primary-grid" data-home-grid="operational">
        <div className="home-map" data-home-module="map">
          <MapRouteCard
            trip={trip}
            onSaveLocation={editableActions?.saveCampsite}
            variant="home"
          />
        </div>

        <section className="home-weather" data-home-module="weather" aria-label="Weather and forecast">
          <WeatherCard
            tripId={trip.id}
            weather={data.currentWeather}
            weatherRefresh={data.weatherRefresh}
            astro={data.astro}
            forecast={data.forecast}
            variant="home"
          />
        </section>

        <div className="home-readiness" data-home-module="readiness">
          <ReadinessSummaryCard
            readiness={readiness}
            href={`${base}/gear`}
            showMeals={data.settings.show_meals}
            showOffline={data.settings.show_offline}
          />
        </div>

        <div className="home-today" data-home-module="day-plan">
          <TodaySummaryCard summary={schedule} href={`${base}/plan`} />
        </div>

        <div className="home-priority" data-home-module="priority-notice">
          <PriorityAlertCard alert={priorityAlert} href={`${base}/guide`} />
        </div>
      </div>

      <div className="home-workspaces">
        <TripSectionLinks
          tripId={trip.id}
          tripDays={tripDays}
          timeline={timeline}
          meals={meals}
          gear={gear}
          crew={crew}
          alerts={visibleAlerts}
          offlineStatus={offlineStatus}
          parkIntel={parkIntel}
          prepFeed={prepFeed}
          schedule={schedule}
          showMeals={data.settings.show_meals}
          showCrew={data.settings.show_crew}
          showOffline={data.settings.show_offline}
          showAstro={data.settings.show_astro}
          hasAstro={data.astro !== null}
        />
      </div>

      <footer className="home-overview__footer text-center text-xs text-text-muted">
        {trip.park_name} · Workspace synced
      </footer>
    </div>
  );
}
