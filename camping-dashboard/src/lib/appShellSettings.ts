// App-shell routes do not have trip weather context, so they use the primary
// Expedition theme in its light presentation.
export const APP_SHELL_SETTINGS = {
  trip_id: '',
  manual_theme_override: 'day' as const,
  preferred_units: 'metric' as const,
  show_astro: false,
  show_meals: false,
  show_offline: false,
  show_crew: false,
  theme_variant: 'expedition' as const,
};
