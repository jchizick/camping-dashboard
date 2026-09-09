/** Existing explicit weather request, shared with the legacy Weather card. */
export function requestWeatherRefresh(tripId: string) {
  return fetch('/api/refresh-weather', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tripId }),
  });
}

export function forecastDayLabel(date: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString('en-CA', { weekday: 'short' });
}
