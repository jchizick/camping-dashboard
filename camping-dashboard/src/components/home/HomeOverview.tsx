'use client';

import React, { useState } from 'react';
import HeroHeader from '@/components/cards/HeroHeader';
import MapRouteCard from '@/components/cards/MapRouteCard';
import WeatherCard from '@/components/cards/WeatherCard';
import MissionBriefModal from '@/components/ui/MissionBriefModal';
import { useTheme } from '@/lib/themeContext';
import { useTripWorkspace } from '@/components/trip/TripWorkspaceProvider';
import CompactForecastCard from './CompactForecastCard';
import PriorityAlertCard from './PriorityAlertCard';
import ReadinessSummaryCard from './ReadinessSummaryCard';
import TodaySummaryCard from './TodaySummaryCard';
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
  const { themeMode } = useTheme();
  const [missionBriefOpen, setMissionBriefOpen] = useState(false);

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
    <div className="relative z-10 mx-auto min-h-screen max-w-[1600px] space-y-6 p-4 md:p-6 lg:p-8">
      <HeroHeader
        trip={trip}
        weather={data.currentWeather}
        readiness={readiness}
        countdown={countdown}
        themeMode={themeMode}
        onMissionBrief={() => setMissionBriefOpen(true)}
      />

      <MissionBriefModal
        isOpen={missionBriefOpen}
        onClose={() => setMissionBriefOpen(false)}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="order-1 lg:order-2 lg:col-span-4">
          <WeatherCard
            tripId={trip.id}
            weather={data.currentWeather}
            weatherRefresh={data.weatherRefresh}
            astro={data.astro}
          />
        </div>

        <div className="order-2 lg:order-4 lg:col-span-4">
          <ReadinessSummaryCard
            readiness={readiness}
            href={`${base}/gear`}
            showMeals={data.settings.show_meals}
            showOffline={data.settings.show_offline}
          />
        </div>

        <div className="order-3 lg:order-5 lg:col-span-8">
          <TodaySummaryCard summary={schedule} href={`${base}/plan`} />
        </div>

        <div className="order-4 lg:order-6 lg:col-span-4">
          <PriorityAlertCard alert={priorityAlert} href={`${base}/guide`} />
        </div>

        <div className="order-5 lg:order-1 lg:col-span-8">
          <MapRouteCard
            trip={trip}
            onSaveLocation={editableActions?.saveCampsite}
          />
        </div>

        <div className="order-6 lg:order-3 lg:col-span-8">
          <CompactForecastCard forecast={data.forecast} />
        </div>
      </div>

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

      <footer className="py-8 text-center text-xs font-mono uppercase tracking-widest text-text-muted">
        {trip.park_name} · {trip.name} · Supabase live
      </footer>
    </div>
  );
}
