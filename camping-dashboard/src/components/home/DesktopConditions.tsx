'use client';

import { useId, useRef, useState } from 'react';
import { useOptionalTripWorkspaceStatus } from '@/components/trip/TripWorkspaceStatus';
import { cachedWeatherPresentation } from '@/lib/offlineFreshness';
import { forecastDayLabel } from '@/lib/weatherPresentation';
import type { HomeViewModel } from './homeViewModel';

export default function DesktopConditions({ conditions, onRefresh }: {
  conditions: HomeViewModel['conditions'];
  onRefresh?: () => Promise<void>;
}) {
  const workspace = useOptionalTripWorkspaceStatus();
  const cached = workspace?.source === 'cache';
  const { currentWeather: weather, weatherRefresh } = conditions;
  const freshness = cachedWeatherPresentation(weather, weatherRefresh, conditions.forecast);
  const stale = weatherRefresh?.status === 'failed' || weatherRefresh?.status === 'retry';
  const [expanded, setExpanded] = useState(false);
  const [refreshState, setRefreshState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');
  const pending = useRef(false);
  const forecastId = useId();
  const refreshing = refreshState === 'loading' || weatherRefresh?.status === 'refreshing';
  const canRefresh = !!onRefresh && !cached && (!workspace || workspace.connectivity === 'online');
  const forecast = (cached ? freshness.futureForecast : conditions.forecast).slice(0, 5);

  async function refresh() {
    if (!canRefresh || refreshing || pending.current) return;
    pending.current = true;
    setRefreshState('loading');
    setError('');
    try {
      await onRefresh!();
      setRefreshState('success');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Weather could not be refreshed. Existing weather remains available.');
      setRefreshState('error');
    } finally {
      pending.current = false;
    }
  }

  return <section className="dwo-conditions" aria-labelledby="dwo-conditions-title">
    <div><h2 id="dwo-conditions-title">{cached && freshness.isPrevious ? 'Previous conditions' : 'Conditions'}</h2>
      <p className="dwo-meta">{cached ? freshness.label : weatherRefresh?.status === 'refreshing' ? 'Refreshing weather…' : stale ? (weather ? 'Stale weather · refresh needs attention' : 'Weather unavailable · refresh needs attention') : weather ? freshness.label.replace('Cached · updated', 'Updated').replace('Cached · update', 'Update') : 'Weather unavailable'}</p>
    </div>
    <p className="dwo-weather"><strong>{weather && Number.isFinite(weather.temperature_c) ? `${Math.round(weather.temperature_c)}°C` : '—'}</strong><span>{weather?.condition_label || 'Conditions unavailable'}</span></p>
    <div className="dwo-weather-actions">
      {canRefresh && <button type="button" onClick={() => void refresh()} disabled={refreshing} aria-label="Refresh weather">{refreshing ? 'Refreshing…' : 'Refresh'}</button>}
      <button type="button" aria-expanded={expanded} aria-controls={forecastId} onClick={() => setExpanded(value => !value)}>{expanded ? 'Hide forecast' : 'View forecast'}</button>
    </div>
    <p className="dwo-sunset"><span>Sunset{cached && freshness.isPrevious ? ' (saved)' : ''}</span><strong>{weather?.sunset_time || 'Unavailable'}</strong></p>
    <span className="sr-only" role="status">{refreshing ? 'Refreshing weather…' : refreshState === 'success' ? 'Weather refresh completed.' : ''}</span>
    {error && <p className="dwo-weather-error" role="alert">{error}</p>}
    {expanded && <div className="dwo-forecast" id={forecastId}>
      {forecast.length ? <ul aria-label={cached ? 'Cached forecast' : 'Forecast'}>{forecast.map(day => <li key={day.id}>
        <time dateTime={day.forecast_date} title={day.forecast_date}>{forecastDayLabel(day.forecast_date)} · {day.forecast_date.slice(5)}</time>
        <p><strong>{day.high_c === null ? '—' : `${Math.round(day.high_c)}°`}</strong> / {day.low_c === null ? '—' : `${Math.round(day.low_c)}°`}</p>
        <p>{day.condition_label || 'Conditions unavailable'}</p>
        <p className="dwo-meta">Rain {day.rain_chance === null ? '—' : `${day.rain_chance}%`}</p>
      </li>)}</ul> : <p className="dwo-meta">{cached ? 'No upcoming forecast saved.' : 'Forecast unavailable.'}</p>}
    </div>}
  </section>;
}
