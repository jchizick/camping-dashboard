'use client';

import { useId, useState } from 'react';
import type { ParkIntel } from '@/types';
import AlertFormSheet from '@/components/cards/AlertFormSheet';
import ParkIntelFormSheet from '@/components/cards/ParkIntelFormSheet';
import { useTripWorkspace, type TripWorkspaceEditableActions } from '@/components/trip/TripWorkspaceProvider';
import { useOptionalTripWorkspaceStatus } from '@/components/trip/TripWorkspaceStatus';
import { useTripClockTick } from '@/components/trip/useTripCountdown';
import { cachedNoticePresentation } from '@/lib/offlineFreshness';
import { FIELD_PREP_CHECKS } from './fieldPrepChecklist';
import { createFieldViewModel, type FieldNotice, type FieldViewModel } from './fieldViewModel';
import './desktopWorkspaceField.css';

const EMPTY_INTEL: ParkIntel = {
  trip_id: '', fire_restriction: 'Unknown', wildlife_notes: '', ranger_station: '',
  firewood_percent: 0, water_notes: '', custom_notes: '', updated_at: '',
};

// Literal truncation only; the shared view model owns notice interpretation.
function excerpt(value: string, limit: number) {
  return value.length > limit ? `${value.slice(0, limit).trimEnd()}…` : value;
}

function ReferenceText({ text, label, limit = 120 }: { text: string | null; label: string; limit?: number }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  if (!text) return <span>Not recorded</span>;
  if (text.length <= limit) return <span>{text}</span>;
  return <>
    {!open && <span>{excerpt(text, limit)} </span>}
    <button type="button" className="dwf-disclosure" aria-expanded={open} aria-controls={id}
      onClick={() => setOpen(!open)}>{open ? 'Hide' : 'Read'} {label.toLowerCase()}</button>
    {open && <p id={id} className="dwf-full-text">{text}</p>}
  </>;
}

function CachedNoticeAge({ states }: { states: FieldViewModel['alertRefreshStates'] }) {
  const workspace = useOptionalTripWorkspaceStatus();
  const cached = workspace?.source === 'cache';
  useTripClockTick(cached);
  if (!cached) return null;
  const presentation = cachedNoticePresentation(states ?? null);
  return <p className="dwf-meta" title={presentation.exactTimestamp ?? undefined}>{presentation.label}</p>;
}

function Notice({ notice, actions, onDelete }: {
  notice: FieldNotice; actions: TripWorkspaceEditableActions | null; onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const { alert } = notice;
  return <li data-field-notice={alert.id} data-severity={alert.severity}>
    <span className="dwf-severity">{alert.severity}</span>
    <h4>{excerpt(notice.displayTitle, 100)}</h4>
    <p className="dwf-excerpt">{excerpt(notice.summary, 180)}</p>
    <button type="button" className="dwf-disclosure" aria-expanded={open} aria-controls={id}
      aria-label={`${open ? 'Hide' : 'View'} notice: ${notice.displayTitle}`} onClick={() => setOpen(!open)}>
      {open ? 'Hide notice' : 'View notice'}
    </button>
    {open && <div id={id} className="dwf-notice-detail">
      <p className="dwf-original-title">{alert.title}</p>
      <p className="dwf-full-text" data-field-notice-body>{alert.body}</p>
      <p className="dwf-meta">{notice.sourceLabel}{notice.updatedLabel ? ` · Updated ${notice.updatedLabel}` : ''}</p>
      <div className="dwf-actions">
        {!notice.isManual && alert.source_url && <a href={alert.source_url} target="_blank" rel="noopener noreferrer">Open source</a>}
        {notice.isManual && actions?.deleteAlert && <button type="button" onClick={() => onDelete(alert.id)}>Delete note</button>}
        {!notice.isManual && actions?.dismissAlert && <button type="button" disabled={busy} onClick={async () => {
          setBusy(true); setError(null);
          try { await actions.dismissAlert(alert.id); }
          catch { setError('Could not dismiss this notice. Please try again.'); }
          finally { setBusy(false); }
        }}>Dismiss notice</button>}
      </div>
      {error && <p role="alert">{error}</p>}
    </div>}
  </li>;
}

function FieldContent({ model, actions }: { model: FieldViewModel; actions: TripWorkspaceEditableActions | null }) {
  const [showAll, setShowAll] = useState(false);
  const [editor, setEditor] = useState<'notice' | 'intel' | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const status = model.offlineStatus;
  const completed = FIELD_PREP_CHECKS.filter(({ key }) => status?.[key]).length;
  const { essentials, reference, noticeRefresh: refresh } = model;

  async function run(name: string, action: () => Promise<void>, success?: string) {
    if (busy) return;
    setBusy(name); setError(null); setMessage(null);
    try { await action(); if (success) setMessage(success); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'The update could not be saved. Please try again.'); }
    finally { setBusy(null); }
  }

  return <>
    <header className="dwf-heading"><h2 id="desktop-field-title" tabIndex={-1}>Field</h2>
      <p>{model.notices.length} {model.notices.length === 1 ? 'notice' : 'notices'}</p>
    </header>
    {error && <p role="alert" className="dwf-feedback">{error}</p>}
    {message && <p role="status" className="dwf-feedback">{message}</p>}
    <div className="dwf-columns">
      <div className="dwf-essentials">
        {model.showOffline && <section className="dwf-prep" aria-labelledby="desktop-field-prep-title">
          <div className="dwf-subheading"><h3 id="desktop-field-prep-title">Field Prep</h3>
            {status && <span>{completed} / {FIELD_PREP_CHECKS.length} complete</span>}
          </div>
          {status ? <ul className="dwf-checks">
            {FIELD_PREP_CHECKS.map(({ key, label }) => <li key={key}>
              <button type="button" aria-pressed={Boolean(status[key])} disabled={!actions?.toggleOfflineStatus || busy !== null}
                onClick={() => void run(key, () => actions!.toggleOfflineStatus(key))}>
                <span aria-hidden="true">{status[key] ? '✓' : '○'}</span>{label}
              </button>
            </li>)}
          </ul> : <>
            <p className="dwf-meta">Field Prep hasn’t been set up yet.</p>
            {actions?.initializeFieldPrep ? <button type="button" disabled={busy !== null}
              onClick={() => void run('initialize', actions.initializeFieldPrep)}>Set up Field Prep</button> :
              <p className="dwf-meta">Field Prep can be set up when editing is available.</p>}
          </>}
          {status?.satellite_device_connected && status.satellite_device_name && <p className="dwf-meta">Satellite device: {status.satellite_device_name}</p>}
        </section>}
        <section className="dwf-intel" aria-labelledby="desktop-field-intel-title">
          <div className="dwf-subheading"><h3 id="desktop-field-intel-title">Park Intelligence</h3>
            {actions?.updateParkIntel && <button type="button" onClick={() => setEditor('intel')}>Edit park intelligence</button>}
          </div>
          <dl>
            <div><dt>Fire</dt><dd><ReferenceText label="fire status" text={essentials.fire} /></dd></div>
            <div><dt>Water</dt><dd><ReferenceText label="water notes" text={essentials.water} /></dd></div>
            <div><dt>Firewood</dt><dd>{reference.firewoodPercent === null ? 'Not recorded' : `${reference.firewoodPercent}%`}</dd></div>
            <div><dt>Ranger / help</dt><dd>{essentials.rangerHref ? <a href={essentials.rangerHref}>{essentials.ranger}</a> : essentials.ranger || 'Not recorded'}</dd></div>
            <div><dt>Wildlife</dt><dd><ReferenceText label="wildlife notes" text={reference.wildlife} limit={90} /></dd></div>
          </dl>
          <div className="dwf-site"><h4>Site notes{essentials.site ? ` · ${essentials.site.label}` : ''}</h4>
            <ReferenceText label="site notes" text={essentials.site?.notes ?? null} />
          </div>
        </section>
      </div>
      <section className="dwf-notices" aria-labelledby="desktop-field-notices-title">
        <div className="dwf-subheading"><h3 id="desktop-field-notices-title">Notices</h3>
          <div className="dwf-actions">
            {actions?.refreshAlerts && !refresh.unsupported && <button type="button" disabled={busy !== null || refresh.processing}
              onClick={() => void run('refresh', actions.refreshAlerts, 'Notice sources refreshed.')}>Refresh notices</button>}
            {actions?.addAlert && <button type="button" onClick={() => setEditor('notice')}>Add manual notice</button>}
          </div>
        </div>
        <CachedNoticeAge states={model.alertRefreshStates} />
        {refresh.processing && <p className="dwf-meta">Notice sources are refreshing.</p>}
        {refresh.failed && <p className="dwf-stale">{refresh.hasSuccessfulRefresh ? 'Latest refresh failed; previously confirmed notices are retained and may be stale.' : 'Notice sources could not be checked yet.'}</p>}
        {!model.notices.length ? <p className="dwf-meta">{refresh.emptyMessage}</p> : <>
          <ul className="dwf-notice-list" id="desktop-field-notices">
            {(showAll ? model.notices : model.notices.slice(0, 3)).map(notice => <Notice key={notice.alert.id} notice={notice} actions={actions} onDelete={setPendingDelete} />)}
          </ul>
          {model.notices.length > 3 && <button type="button" className="dwf-disclosure" aria-expanded={showAll} aria-controls="desktop-field-notices"
            onClick={() => setShowAll(!showAll)}>{showAll ? 'Show fewer notices' : `Show all ${model.notices.length} notices`}</button>}
        </>}
        {pendingDelete && <div className="dwf-confirm" role="alert"><p>Delete this manual note?</p>
          <button type="button" disabled={busy !== null} onClick={() => setPendingDelete(null)}>Cancel</button>
          <button type="button" disabled={busy !== null} onClick={() => void run('delete', async () => {
            await actions!.deleteAlert(pendingDelete); setPendingDelete(null);
          })}>Delete note</button>
        </div>}
      </section>
    </div>
    {actions && editor === 'notice' && <AlertFormSheet isOpen onClose={() => setEditor(null)} onSubmit={actions.addAlert} />}
    {actions && editor === 'intel' && <ParkIntelFormSheet isOpen onClose={() => setEditor(null)} onSubmit={actions.updateParkIntel} intel={model.parkIntel ?? EMPTY_INTEL} />}
  </>;
}

export default function DesktopWorkspaceFieldSection({ navigationPath }: { navigationPath: string }) {
  const { data, trip, alerts, parkIntel, offlineStatus, readiness, editableActions } = useTripWorkspace();
  if (!data || !trip || !readiness) return null;
  const model = createFieldViewModel({ data, trip, alerts, parkIntel, offlineStatus, manualPrep: readiness.categories.offline });
  return <section className="desktop-workspace-field" data-field-composition="compact-desktop" aria-labelledby="desktop-field-title">
    <FieldContent key={navigationPath} model={model} actions={editableActions} />
  </section>;
}
