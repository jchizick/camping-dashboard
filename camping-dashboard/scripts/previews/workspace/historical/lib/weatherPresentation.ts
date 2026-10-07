// Only the pure label helper is needed by this static capture.
export function forecastDayLabel(date: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString('en-CA', { weekday: 'short' });
}
