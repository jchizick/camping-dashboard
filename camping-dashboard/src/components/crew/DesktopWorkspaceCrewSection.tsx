'use client';

import { useState } from 'react';
import type { CrewMember } from '@/types';
import CrewFormSheet from '@/components/cards/CrewFormSheet';
import { useTripWorkspace } from '@/components/trip/TripWorkspaceProvider';
import GuardedTripLink from '@/components/trip/GuardedTripLink';
import { getCrewGear, getCrewMeals, getUnassignedRequiredGear } from '@/lib/crewResponsibility';
import { formatResponsibility, getCrewLoadBalance, getCrewLoadRows, splitResponsibilities } from './crewViewModel';
import './desktopWorkspaceCrew.css';

function CrewContent() {
  const { crew, gear, meals, trip, editableActions: actions } = useTripWorkspace();
  const [editor, setEditor] = useState<{ member?: CrewMember } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CrewMember | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = getCrewLoadRows(crew);
  const balance = getCrewLoadBalance(load);
  const unassigned = getUnassignedRequiredGear(gear);
  const removedGearCount = pendingDelete ? getCrewGear(pendingDelete.id, gear).length : 0;
  const removedMealCount = pendingDelete ? getCrewMeals(pendingDelete.id, meals).length : 0;

  async function removeMember() {
    if (!pendingDelete || !actions || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      await actions.deleteCrewMember(pendingDelete.id);
      setPendingDelete(null);
    } catch { setError('Could not remove this member. Please try again.'); }
    finally { setDeleting(false); }
  }

  return <>
    <header className="dwc-heading">
      <h2 id="desktop-crew-title" tabIndex={-1}>Crew</h2>
      <p>{crew.length} {crew.length === 1 ? 'member' : 'members'}</p>
      {actions?.addCrewMember && <button type="button" onClick={() => setEditor({})}>Add crew member</button>}
    </header>
    <ul className="dwc-members">
      {load.rows.map(({ member, weight, displayPercentage }) => {
        const systems = splitResponsibilities(member.load_item).map(formatResponsibility);
        return <li key={member.id} data-crew-member={member.id}>
          <div className="dwc-member-copy">
            <h3>{member.name}</h3>
            <p className="dwc-meta">{member.role || 'No role recorded'} · Canoe {member.canoe_number}</p>
            <p className="dwc-systems"><span>Assigned systems</span> {systems.length ? systems.join(' · ') : 'No system assigned'}</p>
            {member.notes && <details><summary>Notes for {member.name}</summary><p>{member.notes}</p></details>}
          </div>
          <div className="dwc-member-load"><strong>{weight} kg</strong><span>{displayPercentage}% of group load</span></div>
          {actions && <div className="dwc-actions">
            <button type="button" aria-label={`Edit ${member.name}`} onClick={() => setEditor({ member })}>Edit</button>
            <button type="button" aria-label={`Remove ${member.name}`} onClick={() => { setError(null); setPendingDelete(member); }}>Remove</button>
          </div>}
        </li>;
      })}
    </ul>
    {!crew.length && <p className="dwc-empty">No crew members yet. Add a member to record responsibilities and carried load.</p>}
    <section className="dwc-load" aria-labelledby="desktop-crew-load-title">
      <div className="dwc-load-heading">
        <h3 id="desktop-crew-load-title">Expedition load</h3>
        <strong>{Math.round(load.totalLoad)} kg</strong>
        <span className="dwc-balance" data-tone={balance.tone}>{balance.label}</span>
      </div>
      <p className="dwc-meta">Recorded member loads · independent of item weights</p>
      {load.rows.length > 0 ? <ul className="dwc-distribution">
        {load.rows.map(({ member, rawPercentage, displayPercentage, weight }) => <li key={member.id}>
          <span>{member.name}</span>
          <div className="dwc-bar" role="img" aria-label={`${member.name}: ${weight} kg, ${displayPercentage}% of group load`}>
            <span style={{ width: `${rawPercentage}%` }} />
          </div>
          <span>{displayPercentage}%</span>
        </li>)}
      </ul> : <p className="dwc-meta">Load distribution will appear after crew members are added.</p>}
    </section>
    {unassigned.length > 0 && <p className="dwc-exception">
      {unassigned.length} Required {unassigned.length === 1 ? 'gear item has' : 'gear items have'} no linked crew member.{' '}
      <GuardedTripLink href={`/trips/${encodeURIComponent(trip!.id)}/gear`}>Review gear</GuardedTripLink>
    </p>}
    {pendingDelete && <div className="dwc-delete" role="alert">
      <p>Remove “{pendingDelete.name}”? {removedGearCount} Gear {removedGearCount === 1 ? 'item' : 'items'} and {removedMealCount} {removedMealCount === 1 ? 'meal' : 'meals'} will become unassigned.</p>
      {error && <p>{error}</p>}
      <button type="button" disabled={deleting} onClick={() => setPendingDelete(null)}>Cancel</button>
      <button type="button" disabled={deleting} onClick={() => void removeMember()}>Confirm removal</button>
    </div>}
    {actions && <CrewFormSheet isOpen={editor !== null} initialMember={editor?.member}
      onClose={() => setEditor(null)} onSubmit={async member => {
        if (editor?.member) await actions.updateCrewMember(editor.member.id, member);
        else await actions.addCrewMember(member);
      }} />}
  </>;
}

export default function DesktopWorkspaceCrewSection({ navigationPath }: { navigationPath: string }) {
  const { data } = useTripWorkspace();
  if (!data) return null;
  return <section className="desktop-workspace-crew" data-crew-composition="compact-desktop" aria-labelledby="desktop-crew-title">
    {data.settings.show_crew ? <CrewContent key={navigationPath} /> : <>
      <h2 id="desktop-crew-title" tabIndex={-1}>Crew</h2>
      <p className="dwc-empty">The crew module is hidden for this trip.</p>
    </>}
  </section>;
}
