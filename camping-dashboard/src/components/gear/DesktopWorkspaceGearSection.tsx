'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { GearItem } from '@/types';
import { useTripWorkspace } from '@/components/trip/TripWorkspaceProvider';
import { useOptionalTripDraftGuard } from '@/components/trip/TripDraftGuardProvider';
import GearFormSheet from '@/components/cards/GearFormSheet';
import { calculateEstimatedGearWeight, formatEstimatedGearWeight } from '@/lib/helpers';
import { resolveCrewResponsibility } from '@/lib/crewResponsibility';
import { getGearCategories, requiredGearBrief } from './gearViewModel';
import './desktopWorkspaceGear.css';

type GearView = 'remaining' | 'required' | 'packed' | 'all';

function GearContent({ navigationPath }: { navigationPath: string }) {
  const { gear, crew, readiness, editableActions: actions, source, trip } = useTripWorkspace();
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftGuard = useOptionalTripDraftGuard();
  const [view, setView] = useState<GearView>('remaining');
  const [category, setCategory] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [editor, setEditor] = useState<{ item?: GearItem; required?: boolean } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<GearItem | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const consumedIntent = useRef(false);
  const isGearRoute = navigationPath === `/trips/${encodeURIComponent(trip!.id)}/gear`;
  const addRequired = isGearRoute && searchParams.get('intent') === 'add-required';

  useEffect(() => {
    if (!addRequired) { consumedIntent.current = false; return; }
    if (consumedIntent.current || source === 'cache') return;
    consumedIntent.current = true;
    const consume = () => {
      const remaining = new URLSearchParams(searchParams.toString());
      remaining.delete('intent');
      router.replace(`${navigationPath}${remaining.size ? `?${remaining}` : ''}`, { scroll: false });
      if (actions?.addGearItem) {
        // Give the intent-opened sheet a meaningful return-focus destination.
        const heading = document.getElementById('desktop-gear-title');
        heading?.focus({ preventScroll: true });
        heading?.scrollIntoView({ block: 'start', behavior: 'auto' });
        setEditor({ required: true });
      }
    };
    if (draftGuard) void draftGuard.requestAction(consume);
    else consume();
  }, [addRequired, actions, draftGuard, navigationPath, router, searchParams, source]);

  const categories = getGearCategories(gear);
  const packed = gear.filter(item => item.packed);
  const required = gear.filter(item => item.priority === 'critical');
  const incomplete = gear.filter(item => !item.packed);
  // Required items lead; preserve source order within each group.
  const remaining = [...incomplete.filter(item => item.priority === 'critical'), ...incomplete.filter(item => item.priority !== 'critical')];
  const selected = category ? categories.find(([name]) => name === category)?.[1] ?? []
    : view === 'required' ? required : view === 'packed' ? packed : view === 'all' ? gear : remaining;
  const title = category ?? ({ remaining: 'Needs packing', required: 'Required gear', packed: 'Packed gear', all: 'All gear' }[view]);
  const brief = requiredGearBrief(readiness!.categories.gear);
  const weight = formatEstimatedGearWeight(calculateEstimatedGearWeight(gear));

  async function mutate(id: string, action: () => Promise<void>) {
    if (busy) return;
    setBusy(id);
    setError(null);
    try { await action(); } catch { setError('Could not update gear. Please try again.'); }
    finally { setBusy(null); }
  }

  return <>
    <header className="dwg-heading"><h2 id="desktop-gear-title" tabIndex={-1}>Gear</h2>
      <p><strong>{packed.length} / {gear.length}</strong> packed</p>
      {actions && <button type="button" onClick={() => setEditor({})}>Add gear</button>}
    </header>
    <dl className="dwg-metrics">
      <div><dt>Gear readiness</dt><dd>{readiness!.categories.gear.score === null ? 'Unavailable' : `${readiness!.categories.gear.score}%`}</dd></div>
      <div><dt>Estimated weight</dt><dd>{weight}</dd></div>
      <div><dt>Required packed</dt><dd>{required.length ? `${required.filter(item => item.packed).length} / ${required.length}` : 'Not identified'}</dd></div>
    </dl>
    <div className="dwg-required" data-attention={brief.tone !== 'ready'}>
      <h3>{brief.title}</h3><p>{brief.detail}</p>
      {brief.tone === 'coverage' && actions && <button type="button" onClick={() => setEditor({ required: true })}>Identify required gear</button>}
    </div>
    <div className="dwg-views" role="group" aria-label="Gear views">
      {(['remaining', 'required', 'packed', 'all'] as const).map(option => <button key={option} type="button"
        data-gear-view={option} aria-pressed={!category && view === option} onClick={() => { setView(option); setCategory(null); setShowAll(false); }}>
        {{ remaining: 'Needs packing', required: 'Required', packed: 'Packed', all: 'All gear' }[option]}</button>)}
    </div>
    <section aria-labelledby="desktop-gear-items-title">
      <h3 id="desktop-gear-items-title" data-needs-packing={!category && view === 'remaining'} tabIndex={-1}>{title} <span>{selected.length} items</span></h3>
      {error && <p role="alert">{error}</p>}
      <ul id="desktop-gear-items" className="dwg-items">
        {(showAll ? selected : selected.slice(0, 6)).map(item => {
          const responsibility = resolveCrewResponsibility(item.responsible_crew_member_id, item.owner, crew);
          const stateLabel = item.packed ? 'Packed' : item.priority === 'critical' && !item.acquired
            ? 'Missing · Not acquired' : item.priority === 'critical' ? 'On hand · Needs packing' : item.acquired ? 'On hand' : 'Not acquired';
          return <li key={item.id} data-gear-item={item.id} data-required-incomplete={item.priority === 'critical' && !item.packed}>
            <div className="dwg-item-copy"><h4>{item.name}</h4>{item.priority === 'critical' && <span className="dwg-required-label">Required</span>}
              <p>{stateLabel}{responsibility.kind !== 'unassigned' ? ` · ${responsibility.label}` : ''}</p>
              {item.notes && <p>{item.notes}</p>}
            </div>
            <div className="dwg-item-actions">
              <button type="button" disabled={!actions || busy !== null} aria-pressed={item.acquired} aria-label={`${item.name} — ${item.acquired ? 'on hand' : 'not acquired'}`}
                onClick={() => void mutate(item.id, () => actions!.toggleGearAcquired(item.id))}>{item.acquired ? 'On hand' : 'Acquire'}</button>
              <button type="button" disabled={!actions || busy !== null} aria-pressed={item.packed} aria-label={`${item.name} — ${item.packed ? 'packed' : 'not packed'}`}
                onClick={() => void mutate(item.id, () => actions!.toggleGearPacked(item.id))}>{item.packed ? 'Packed' : 'Pack'}</button>
              {actions && <><button type="button" aria-label={`Edit ${item.name}`} onClick={() => setEditor({ item })}>Edit</button>
                <button type="button" aria-label={`Remove ${item.name}`} onClick={() => setPendingDelete(item)}>Remove</button></>}
            </div>
          </li>;
        })}
      </ul>
      {!selected.length && <p className="dwg-empty">{!gear.length ? 'No gear added yet.' : view === 'remaining' && !category ? 'Everything on this list is packed.' : view === 'required' && !category ? 'No Required gear identified.' : 'No items in this view.'}</p>}
      {selected.length > 6 && <button type="button" className="dwg-disclosure" aria-expanded={showAll} aria-controls="desktop-gear-items"
        onClick={() => setShowAll(!showAll)}>{showAll ? 'Show fewer items' : `Show all ${selected.length} items`}</button>}
    </section>
    <section className="dwg-systems" aria-labelledby="desktop-gear-systems-title"><h3 id="desktop-gear-systems-title">By system</h3>
      <div>{categories.map(([name, items]) => <button key={name} type="button" aria-expanded={category === name} aria-controls="desktop-gear-items"
        onClick={() => {
          setCategory(category === name ? null : name);
          setShowAll(false);
          window.requestAnimationFrame(() => {
            const heading = document.getElementById('desktop-gear-items-title');
            heading?.focus({ preventScroll: true });
            heading?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
          });
        }}>
        <span>{name}</span><span>{items.filter(item => item.packed).length} / {items.length} packed</span>
      </button>)}</div>
    </section>
    {pendingDelete && <div className="dwg-delete" role="alert"><p>Remove “{pendingDelete.name}”?</p>
      <button type="button" disabled={busy !== null} onClick={() => setPendingDelete(null)}>Cancel</button>
      <button type="button" disabled={busy !== null} onClick={() => void mutate(pendingDelete.id, async () => {
        await actions!.deleteGearItem(pendingDelete.id); setPendingDelete(null);
      })}>Confirm removal</button></div>}
    {actions && <GearFormSheet isOpen={editor !== null} initialItem={editor?.item} defaultRequired={editor?.required} crew={crew}
      onClose={() => setEditor(null)} onSubmit={async item => {
        if (editor?.item) await actions.updateGearItem(editor.item.id, item);
        else await actions.addGearItem(item);
      }} />}
  </>;
}

export default function DesktopWorkspaceGearSection({ navigationPath }: { navigationPath: string }) {
  const { data, trip, readiness } = useTripWorkspace();
  if (!data || !trip || !readiness) return null;
  return <section className="desktop-workspace-gear" data-gear-composition="compact-desktop" aria-labelledby="desktop-gear-title">
    <GearContent key={navigationPath} navigationPath={navigationPath} />
  </section>;
}
