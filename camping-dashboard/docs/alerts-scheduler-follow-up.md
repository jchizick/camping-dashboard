# Follow-up: multi-trip park and emergency alerts

This is a proposal only. It is separate from weather refresh and makes no
changes to `/api/refresh-alerts`, its 11:15 UTC Vercel Cron entry, existing
Algonquin behavior, or hosted alert data.

## Current limitation

The existing route writes Ontario Parks and Environment Canada results to the
hardcoded `trip-maple-lake-001`. Ontario/Algonquin applicability is therefore
implicit, and generic trips cannot safely participate in one multi-trip run.

Weather forecasts and park/emergency alerts must remain separate normalized
domains. A weather provider's geographic forecast does not establish that an
Ontario Parks advisory applies to the same trip.

## Required metadata and adapters

A replacement first needs canonical jurisdiction metadata on each trip or its
park/location model, such as country, province/state, park system, park
identifier, and applicable alert regions. It should then use explicit provider
adapters:

- Ontario Parks for supported Ontario park operational notices;
- Environment and Climate Change Canada for supported Canadian alert regions;
- a neutral unsupported result for trips with no applicable provider.

The initial adapters must preserve Algonquin output and deduplication before
the hardcoded trip behavior is removed.

## Coordinator design

Use one bounded multi-trip coordinator, not one job per trip. Select due trips
by supported jurisdiction, canonical location metadata, alert freshness, and
trip date relevance. Process a small batch with shared locking and independent
per-trip failure handling.

Normalize source identifier, jurisdiction, severity, effective/expiry times,
deduplication key, and provider attribution. Expire withdrawn or elapsed alerts
deliberately; do not erase still-valid alerts because one provider fails.
Unsupported trips should be skipped without repeated errors.

## Rollout

1. Add and backfill reviewed jurisdiction metadata.
2. Build adapter fixtures and prove existing Algonquin behavior.
3. Add bounded due selection, deduplication, expiry, locks, and sanitized logs.
4. Deploy through a staged Supabase scheduler while the Vercel alert job
   remains active or is safely shadowed.
5. QA Ontario/Algonquin, supported Canadian, unsupported, and cross-trip
   isolation cases.
6. Retire `/api/refresh-alerts` from Vercel only after successful hosted
   scheduled cycles and production dashboard verification.

No part of the weather migration authorizes this cutover.
