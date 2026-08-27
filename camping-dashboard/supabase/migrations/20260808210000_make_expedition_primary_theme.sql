-- Expedition is the primary theme. Preserve each trip's independent day/night
-- preference while migrating previously Clean trips to the new default.
update public.settings
set theme_variant = 'expedition'
where theme_variant = 'clean';
