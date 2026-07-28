import type { WeatherForecast } from '@/types';
import { Card } from '@/components/ui/Primitives';
import { CalendarDays, CloudRain } from 'lucide-react';

function dayLabel(date: string) {
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString('en-CA', { weekday: 'short' });
}

export default function CompactForecastCard({
  forecast,
}: {
  forecast: WeatherForecast[];
}) {
  return (
    <Card title="Forecast" icon={CalendarDays} className="h-full">
      {forecast.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
          {forecast.slice(0, 5).map((day, index) => (
            <div
              key={day.id}
              className={`forecast-day rounded-xl border border-border-subtle bg-card-bg/50 p-3 text-center ${
                index === 4 ? 'hidden lg:block' : ''
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                {dayLabel(day.forecast_date)}
              </p>
              <p className="mt-2 text-sm font-semibold text-text-main">
                {day.high_c === null ? '—' : `${Math.round(day.high_c)}°`}
                <span className="ml-1 font-normal text-text-muted">
                  / {day.low_c === null ? '—' : `${Math.round(day.low_c)}°`}
                </span>
              </p>
              <p className="mt-1 line-clamp-1 text-[11px] text-text-muted">
                {day.condition_label}
              </p>
              <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-accent-blue">
                <CloudRain size={12} aria-hidden="true" />
                {day.rain_chance === null ? 'Unavailable' : `${day.rain_chance}%`}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border-subtle px-5 py-8 text-center text-sm text-text-muted">
          Forecast unavailable.
        </div>
      )}
    </Card>
  );
}
