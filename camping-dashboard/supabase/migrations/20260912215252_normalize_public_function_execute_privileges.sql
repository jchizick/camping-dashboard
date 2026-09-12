-- User-session RPCs: provider defaults must not grant a service-role entry point.
-- Exact signatures are derived from their creation migrations. Bodies and owners
-- are deliberately unchanged; authenticated execution remains intentional.
revoke execute on function
  public.claim_trip_alerts_manual(text, text, integer, integer),
  public.claim_trip_weather_manual(text, text, integer, integer),
  public.create_trip(text, date, date, double precision, double precision, text, text, text, text, text, text)
from public, anon, service_role;

grant execute on function
  public.claim_trip_alerts_manual(text, text, integer, integer),
  public.claim_trip_weather_manual(text, text, integer, integer),
  public.create_trip(text, date, date, double precision, double precision, text, text, text, text, text, text)
to authenticated;
