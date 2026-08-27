import MapRouteCard from '@/components/cards/MapRouteCard';
import WeatherCard from '@/components/cards/WeatherCard';
import type { CampsiteSelection } from '@/components/maps/CampsiteMapSelector';
import PriorityAlertCard from './PriorityAlertCard';
import ReadinessSummaryCard from './ReadinessSummaryCard';
import TodaySummaryCard from './TodaySummaryCard';
import TripHero from './TripHero';
import TripSituationRail from './TripSituationRail';
import type { HomeViewModel } from './homeViewModel';

export default function DesktopHomeOverview({
  model,
  onSaveLocation,
}: {
  model: HomeViewModel;
  onSaveLocation?: (selection: CampsiteSelection) => Promise<void>;
}) {
  return (
    <div
      className="home-overview home-overview--desktop"
      data-home-composition="desktop"
    >
      <div className="home-heading-region">
        <TripHero trip={model.trip} />
        <TripSituationRail
          weather={model.conditions.currentWeather}
          readiness={model.readiness}
          schedule={model.schedule}
        />
      </div>

      <div className="home-primary-grid" data-home-grid="operational">
        <div className="home-map" data-home-module="map">
          <MapRouteCard
            trip={model.trip}
            onSaveLocation={onSaveLocation}
            variant="home"
          />
        </div>

        <section
          className="home-weather"
          data-home-module="weather"
          aria-label="Weather and forecast"
        >
          <WeatherCard
            tripId={model.trip.id}
            weather={model.conditions.currentWeather}
            weatherRefresh={model.conditions.weatherRefresh}
            astro={model.conditions.astro}
            forecast={model.conditions.forecast}
            variant="home"
          />
        </section>

        <div className="home-readiness" data-home-module="readiness">
          <ReadinessSummaryCard
            readiness={model.readiness}
            href={model.hrefs.gear}
          />
        </div>

        <div className="home-today" data-home-module="day-plan">
          <TodaySummaryCard summary={model.schedule} href={model.hrefs.plan} />
        </div>

        <div className="home-priority" data-home-module="trip-notice">
          <PriorityAlertCard alert={model.notice} href={model.hrefs.field} />
        </div>
      </div>
    </div>
  );
}
