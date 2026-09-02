'use client';

import React, { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  CloudRain,
  CloudSun,
  Droplets,
  ExternalLink,
  Flame,
  MapPin,
  Loader2,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Sunset,
  Trees,
  Wind,
  X,
} from 'lucide-react';
import AlertFormSheet from '@/components/cards/AlertFormSheet';
import ParkIntelFormSheet from '@/components/cards/ParkIntelFormSheet';
import type { TripWorkspaceEditableActions } from '@/components/trip/TripWorkspaceProvider';
import type { Alert, OfflineStatus, ParkIntel } from '@/types';
import { FIELD_PREP_CHECKS } from './fieldPrepChecklist';
import type { FieldNotice, FieldViewModel } from './fieldViewModel';
import { useOptionalTripWorkspaceStatus } from '@/components/trip/TripWorkspaceStatus';
import {
  cachedNoticePresentation,
  cachedWeatherPresentation,
} from '@/lib/offlineFreshness';

function EssentialItem({
  icon: Icon,
  label,
  children,
  className = '',
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`mobile-field-essential ${className}`}>
      <Icon size={17} aria-hidden="true" />
      <div>
        <p className="mobile-field-essential__label">{label}</p>
        {children}
      </div>
    </div>
  );
}

function noticeTone(severity: Alert['severity']) {
  if (severity === 'critical') return 'critical';
  if (severity === 'info' || severity === 'advisory') return 'info';
  return 'warning';
}

function MobileFieldNotices({
  model,
  actions,
}: {
  model: FieldViewModel;
  actions: TripWorkspaceEditableActions | null;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const state = model.noticeRefresh;
  const workspace = useOptionalTripWorkspaceStatus();
  const cachedPresentation = workspace?.source === 'cache'
    ? cachedNoticePresentation(model.alertRefreshStates)
    : null;

  async function refresh() {
    if (!actions?.refreshAlerts || refreshing) return;
    setRefreshing(true);
    setRefreshMessage(null);
    try {
      await actions.refreshAlerts();
      setRefreshMessage('Notice sources refreshed.');
    } catch (error) {
      setRefreshMessage(
        error instanceof Error ? error.message : 'Notices could not be refreshed.'
      );
    } finally {
      setRefreshing(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDeleteId || !actions?.deleteAlert) return;
    await actions.deleteAlert(pendingDeleteId);
    setPendingDeleteId(null);
  }

  function noticeDetail(notice: FieldNotice) {
    const { alert } = notice;
    const tone = noticeTone(alert.severity);
    const canRemove = notice.isManual ? actions?.deleteAlert : actions?.dismissAlert;

    return (
      <details
        className="mobile-field-notice"
        data-tone={tone}
        key={alert.id}
      >
        <summary>
          <div className="mobile-field-notice__severity">
            <AlertTriangle size={14} aria-hidden="true" />
            <span>{alert.severity}</span>
          </div>
          <h3>{notice.displayTitle}</h3>
          <p>{notice.summary}</p>
          <div className="mobile-field-notice__meta">
            <span>{notice.sourceLabel}</span>
            {notice.updatedLabel ? <span>Updated {notice.updatedLabel}</span> : null}
          </div>
          <span className="mobile-field-notice__disclosure">
            <span className="mobile-field-notice__view">View details</span>
            <span className="mobile-field-notice__hide">Hide details</span>
            <ChevronDown size={15} aria-hidden="true" />
          </span>
        </summary>
        <div className="mobile-field-notice__detail">
          <p>{alert.body}</p>
          <div className="mobile-field-notice__actions">
            {alert.source_url && !notice.isManual ? (
              <a
                href={alert.source_url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open notice source: ${notice.sourceLabel}`}
              >
                Source <ExternalLink size={14} aria-hidden="true" />
              </a>
            ) : null}
            {canRemove ? (
              <button
                type="button"
                onClick={() =>
                  notice.isManual
                    ? setPendingDeleteId(alert.id)
                    : void actions?.dismissAlert(alert.id)
                }
              >
                {notice.isManual ? 'Delete note' : 'Dismiss notice'}
              </button>
            ) : null}
          </div>
        </div>
      </details>
    );
  }

  return (
    <section
      className="mobile-field-section mobile-field-notices"
      aria-labelledby="mobile-field-notices-title"
    >
      <div className="mobile-field-section__heading">
        <div>
          <p>Current information</p>
          <h2
            id="mobile-field-notices-title"
            aria-label={model.notices.length ? `Notices · ${model.notices.length}` : 'Notices'}
          >
            Notices
            {model.notices.length ? (
              <span className="mobile-field-notices__count"> · {model.notices.length}</span>
            ) : null}
          </h2>
        </div>
        <div className="mobile-field-section__actions">
          {actions?.refreshAlerts && !state.unsupported ? (
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={refreshing || state.processing}
              aria-label="Refresh notices"
            >
              <RefreshCw
                size={17}
                className={refreshing || state.processing ? 'animate-spin' : ''}
                aria-hidden="true"
              />
            </button>
          ) : null}
          {actions?.addAlert ? (
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              aria-label="Add manual notice"
            >
              <Plus size={18} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      {pendingDeleteId ? (
        <div className="mobile-field-confirmation" role="alert">
          <span>Delete this manual note?</span>
          <button type="button" onClick={() => setPendingDeleteId(null)}>
            Cancel
          </button>
          <button type="button" data-tone="danger" onClick={() => void confirmDelete()}>
            Delete
          </button>
        </div>
      ) : null}
      {state.failed && state.hasSuccessfulRefresh ? (
        <p className="mobile-field-notices__stale" role="status">
          Latest refresh failed; confirmed notices are retained and may be stale.
        </p>
      ) : null}
      {cachedPresentation ? (
        <p
          className="mobile-field-notices__stale"
          role="status"
          title={cachedPresentation.exactTimestamp ?? undefined}
        >
          {cachedPresentation.label}
        </p>
      ) : null}
      {refreshMessage ? <p className="mobile-field-notices__message" role="status">{refreshMessage}</p> : null}

      <div className="mobile-field-notices__list">
        {model.notices.length ? (
          model.notices.map(noticeDetail)
        ) : (
          <div className="mobile-field-notices__empty" role="status">
            <CheckCircle2 size={19} aria-hidden="true" />
            <div>
              <h3>
                {cachedPresentation && !cachedPresentation.trustedEmpty
                  ? 'Notice status unavailable offline'
                  : 'No active notices'}
              </h3>
              <p>
                {cachedPresentation && !cachedPresentation.trustedEmpty
                  ? 'The saved trip does not contain a confirmed successful notice check.'
                  : state.emptyMessage}
              </p>
            </div>
          </div>
        )}
      </div>

      {actions?.addAlert ? (
        <AlertFormSheet
          isOpen={sheetOpen}
          onClose={() => setSheetOpen(false)}
          onSubmit={actions.addAlert}
        />
      ) : null}
    </section>
  );
}

function MobileFieldPrep({
  model,
  onToggle,
  onInitialize,
}: {
  model: FieldViewModel;
  onToggle?: (key: keyof OfflineStatus) => Promise<void>;
  onInitialize?: () => Promise<void>;
}) {
  const [initializing, setInitializing] = useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  if (!model.showOffline) return null;

  const category = model.manualPrep;
  const statusLabel =
    category.availability === 'unavailable'
      ? 'Unavailable'
      : category.score === null
        ? 'Not scored'
        : `${category.score}% complete`;

  return (
    <section
      className="mobile-field-section mobile-field-prep"
      aria-labelledby="mobile-field-prep-title"
    >
      <div className="mobile-field-section__heading">
        <div>
          <p>Manual confirmation</p>
          <h2 id="mobile-field-prep-title">Field Prep</h2>
        </div>
        <strong>
          {category.score === null ? (
            statusLabel
          ) : (
            <>
              <span data-mobile-type-role="field-completion">{category.score}%</span>{' '}
              complete
            </>
          )}
        </strong>
      </div>
      {category.availability === 'unavailable' ? (
        <div className="mobile-field-prep__setup">
          <div>
            <h3>Field Prep hasn’t been set up yet</h3>
            <p>
              {onInitialize
                ? 'Set up the manual checklist when you are ready to confirm field preparations.'
                : 'This saved trip is read-only. Field Prep can be set up when editing is available.'}
            </p>
          </div>
          {onInitialize ? (
            <button
              type="button"
              disabled={initializing}
              onClick={async () => {
                if (initializing) return;
                setInitializing(true);
                setInitializationError(null);
                try {
                  await onInitialize();
                } catch (error) {
                  setInitializationError(
                    error instanceof Error ? error.message : 'Field Prep could not be set up.'
                  );
                } finally {
                  setInitializing(false);
                }
              }}
            >
              {initializing ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : null}
              {initializing ? 'Setting up…' : 'Set up Field Prep'}
            </button>
          ) : null}
          {initializationError ? <p role="alert">{initializationError}</p> : null}
        </div>
      ) : (
        <>
      <p className="mobile-field-prep__explanation">{category.explanation}</p>
      <div className="mobile-field-prep__checks">
        {FIELD_PREP_CHECKS.map(({ key, label, icon: Icon }) => {
          const ready = Boolean(model.offlineStatus?.[key]);
          return (
            <button
              type="button"
              className="mobile-field-prep__check"
              data-state={ready ? 'ready' : 'not-ready'}
              key={key}
              onClick={() => void onToggle?.(key)}
              disabled={!onToggle}
              aria-pressed={ready}
              aria-label={`${label}: ${ready ? 'ready' : 'not ready'}`}
            >
              <Icon size={16} aria-hidden="true" />
              <span>{label}</span>
              <span className="mobile-field-prep__state">
                {ready ? <Check size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
                {ready ? 'Ready' : 'Not ready'}
              </span>
            </button>
          );
        })}
      </div>
      {model.offlineStatus?.satellite_device_connected &&
      model.offlineStatus.satellite_device_name ? (
        <p className="mobile-field-prep__device">
          Satellite device: <strong>{model.offlineStatus.satellite_device_name}</strong>
        </p>
      ) : null}
        </>
      )}
    </section>
  );
}

function MobileParkReference({ model }: { model: FieldViewModel }) {
  const { wildlife, firewoodPercent, astro } = model.reference;
  if (!wildlife && firewoodPercent === null && !astro) return null;

  return (
    <details className="mobile-field-reference">
      <summary>
        <span>
          <Trees size={17} aria-hidden="true" />
          Park Reference
        </span>
        <ChevronDown size={16} aria-hidden="true" />
      </summary>
      <div className="mobile-field-reference__content">
        {wildlife ? (
          <section>
            <h2>Wildlife</h2>
            <p>{wildlife}</p>
          </section>
        ) : null}
        {firewoodPercent !== null ? (
          <section>
            <h2>Firewood availability</h2>
            <p>{firewoodPercent}% recorded</p>
          </section>
        ) : null}
        {astro ? (
          <section>
            <h2>Night sky</h2>
            <p>
              {astro.moon_phase} · {astro.moon_illumination}% illumination
            </p>
            {astro.stargazing_notes ? <p>{astro.stargazing_notes}</p> : null}
          </section>
        ) : null}
      </div>
    </details>
  );
}

export default function MobileFieldOverview({
  model,
  actions,
}: {
  model: FieldViewModel;
  actions: TripWorkspaceEditableActions | null;
}) {
  const [intelSheetOpen, setIntelSheetOpen] = useState(false);
  const workspace = useOptionalTripWorkspaceStatus();
  const { essentials } = model;
  const cachedWeather = workspace?.source === 'cache'
    ? cachedWeatherPresentation(
        model.currentWeather,
        model.weatherRefresh,
        []
      )
    : null;
  const hasEssentialRows = Boolean(
    essentials.fire || essentials.water || essentials.ranger || essentials.site
  );
  const editableIntel: ParkIntel = model.parkIntel ?? {
    trip_id: model.trip.id,
    fire_restriction: 'Unknown',
    wildlife_notes: '',
    ranger_station: '',
    firewood_percent: 0,
    water_notes: '',
    custom_notes: '',
    updated_at: '',
  };

  return (
    <div className="mobile-field-overview" data-field-composition="mobile">
      <section
        className="mobile-field-essentials"
        aria-labelledby="mobile-field-essentials-title"
      >
        <div className="mobile-field-section__heading">
          <div>
            <p>Operational brief</p>
            <h2 id="mobile-field-essentials-title">Field Essentials</h2>
          </div>
          {actions?.updateParkIntel ? (
            <button
              type="button"
              className="mobile-field-essentials__edit"
              onClick={() => setIntelSheetOpen(true)}
              aria-label="Edit Field essentials"
            >
              <Pencil size={16} aria-hidden="true" />
              Edit
            </button>
          ) : null}
        </div>

        {essentials.conditions ? (
          <div
            className="mobile-field-conditions"
            aria-label={cachedWeather?.isPrevious ? 'Previous field conditions' : 'Field conditions'}
          >
            <CloudSun size={24} aria-hidden="true" />
            <div className="mobile-field-conditions__primary">
              <strong data-mobile-type-role="field-temperature">
                {essentials.conditions.temperature}
              </strong>
              <span>{essentials.conditions.condition}</span>
            </div>
            <div className="mobile-field-conditions__details">
              {essentials.conditions.rainChance ? (
                <span><CloudRain size={13} aria-hidden="true" />{essentials.conditions.rainChance}</span>
              ) : null}
              {essentials.conditions.wind ? (
                <span><Wind size={13} aria-hidden="true" />{essentials.conditions.wind}</span>
              ) : null}
              {essentials.conditions.sunset ? (
                <span><Sunset size={13} aria-hidden="true" />{essentials.conditions.sunset}</span>
              ) : null}
            </div>
            {cachedWeather ? (
              <small title={cachedWeather.exactTimestamp ?? undefined}>
                {cachedWeather.label}
              </small>
            ) : null}
          </div>
        ) : null}

        {hasEssentialRows ? (
          <div className="mobile-field-essentials__grid">
            {essentials.fire ? (
              <EssentialItem icon={Flame} label="Fire">
                <p>{essentials.fire}</p>
              </EssentialItem>
            ) : null}
            {essentials.water ? (
              <EssentialItem icon={Droplets} label="Water">
                <p>{essentials.water}</p>
              </EssentialItem>
            ) : null}
            {essentials.ranger ? (
              <EssentialItem icon={Phone} label="Ranger / park contact" className="mobile-field-essential--wide">
                {essentials.rangerHref ? (
                  <a
                    href={essentials.rangerHref}
                    aria-label={`Call ranger or park contact: ${essentials.ranger}`}
                  >
                    {essentials.ranger}
                  </a>
                ) : (
                  <p>{essentials.ranger}</p>
                )}
              </EssentialItem>
            ) : null}
            {essentials.site ? (
              <EssentialItem icon={MapPin} label="Site" className="mobile-field-essential--wide">
                <p>{essentials.site.label}</p>
                {essentials.site.location ? <small>{essentials.site.location}</small> : null}
                {essentials.site.notes ? <blockquote>{essentials.site.notes}</blockquote> : null}
              </EssentialItem>
            ) : null}
          </div>
        ) : essentials.conditions ? null : (
          <p className="mobile-field-essentials__empty" role="status">
            Field essentials have not been added yet.
          </p>
        )}

        {actions?.updateParkIntel ? (
          <ParkIntelFormSheet
            isOpen={intelSheetOpen}
            onClose={() => setIntelSheetOpen(false)}
            onSubmit={actions.updateParkIntel}
            intel={editableIntel}
          />
        ) : null}
      </section>

      <MobileFieldNotices model={model} actions={actions} />
      <MobileFieldPrep
        model={model}
        onToggle={actions?.toggleOfflineStatus}
        onInitialize={actions?.initializeFieldPrep}
      />
      <MobileParkReference model={model} />
    </div>
  );
}
