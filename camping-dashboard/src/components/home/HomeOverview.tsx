'use client';

import React from 'react';
import MapRouteCard from '@/components/cards/MapRouteCard';
import WeatherCard from '@/components/cards/WeatherCard';
import { useTripWorkspace } from '@/components/trip/TripWorkspaceProvider';
import CompactForecastCard from './CompactForecastCard';
import PriorityAlertCard from './PriorityAlertCard';
import ReadinessSummaryCard from './ReadinessSummaryCard';
import TodaySummaryCard from './TodaySummaryCard';
import TripHero, { resolveTripHeroImage } from './TripHero';
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
      <div className="home-hero-stage">
        <TripHero
          trip={trip}
          tripDays={tripDays}
          imageSrc={resolveTripHeroImage(trip)}
        />
        <TripSituationRail
          weather={data.currentWeather}
          readiness={readiness}
          schedule={schedule}
        />
      </div>

      <div className="home-primary-grid">
        <div className="home-map">
          <MapRouteCard
            trip={trip}
            onSaveLocation={editableActions?.saveCampsite}
            variant="home"
          />
        </div>

        <div className="home-weather">
          <WeatherCard
            tripId={trip.id}
            weather={data.currentWeather}
            weatherRefresh={data.weatherRefresh}
            astro={data.astro}
            variant="home"
          />
          <CompactForecastCard forecast={data.forecast} />
        </div>

        <div className="home-readiness">
          <ReadinessSummaryCard
            readiness={readiness}
            href={`${base}/gear`}
            showMeals={data.settings.show_meals}
            showOffline={data.settings.show_offline}
          />
        </div>

        <div className="home-today">
          <TodaySummaryCard summary={schedule} href={`${base}/plan`} />
        </div>

        <div className="home-priority">
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

      <footer className="py-8 text-center text-xs text-text-muted">
        {trip.park_name} · Workspace synced
      </footer>
    </div>
  );
}
