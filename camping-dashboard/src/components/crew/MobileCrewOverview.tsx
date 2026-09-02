'use client';

import React, { useMemo, useState } from 'react';
import {
  Backpack,
  ChevronDown,
  Pencil,
  Plus,
  Scale,
  Trash2,
  User,
  Utensils,
} from 'lucide-react';
import type { CrewMember, GearItem, Meal } from '@/types';
import {
  getCrewGear,
  getCrewMeals,
  getUnassignedRequiredGear,
  resolveCrewResponsibility,
} from '@/lib/crewResponsibility';
import CrewFormSheet from '@/components/cards/CrewFormSheet';

interface MobileCrewOverviewProps {
  crew: CrewMember[];
  gear: GearItem[];
  meals: Meal[];
  onAdd?: (member: Omit<CrewMember, 'id' | 'trip_id'>) => Promise<void>;
  onUpdate?: (
    id: string,
    patch: Partial<Omit<CrewMember, 'id' | 'trip_id'>>
  ) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

function plural(count: number, singular: string) {
  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}

export default function MobileCrewOverview({
  crew,
  gear,
  meals,
  onAdd,
  onUpdate,
  onDelete,
}: MobileCrewOverviewProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<CrewMember | undefined>();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const unassignedRequiredGear = useMemo(() => getUnassignedRequiredGear(gear), [gear]);
  const totalLoad = crew.reduce((total, member) => total + member.load_weight_kg, 0);

  function openAdd() {
    setEditingMember(undefined);
    setSheetOpen(true);
  }

  function openEdit(member: CrewMember) {
    setEditingMember(member);
    setSheetOpen(true);
  }

  async function saveMember(data: Omit<CrewMember, 'id' | 'trip_id'>) {
    if (editingMember) await onUpdate?.(editingMember.id, data);
    else await onAdd?.(data);
  }

  async function confirmDelete() {
    if (!pendingDeleteId) return;
    await onDelete?.(pendingDeleteId);
    setPendingDeleteId(null);
  }

  return (
    <div className="mobile-crew-overview" data-crew-composition="mobile">
      <section className="mobile-crew-brief" aria-labelledby="mobile-crew-brief-title">
        <div>
          <p className="mobile-crew-eyebrow">Field responsibilities</p>
          <h2 id="mobile-crew-brief-title">
            {plural(crew.length, 'participant')}
          </h2>
          <p>Gear availability and meal prep leads, organized by person.</p>
        </div>
        {onAdd ? (
          <button type="button" onClick={openAdd}>
            <Plus size={16} aria-hidden="true" /> Add
          </button>
        ) : null}
      </section>

      {unassignedRequiredGear.length > 0 ? (
        <section
          className="mobile-crew-unassigned"
          data-state="pending"
          aria-labelledby="mobile-crew-unassigned-title"
        >
          <div>
            <p className="mobile-crew-unassigned__eyebrow">Optional coordination</p>
            <h3 id="mobile-crew-unassigned-title">
              <span className="mobile-crew-unassigned__count">{unassignedRequiredGear.length}</span>{' '}
              {unassignedRequiredGear.length === 1 ? 'Required Gear item has' : 'Required Gear items have'} no Crew owner
            </h3>
            <p className="mobile-crew-unassigned__guidance">
              {crew.length === 0
                ? 'Travelling solo? Crew assignments are optional.'
                : 'Assign responsibilities when planning with others.'}
            </p>
          </div>
          <ul>
            {unassignedRequiredGear.map((item) => {
              const responsibility = resolveCrewResponsibility(
                item.responsible_crew_member_id,
                item.owner,
                crew
              );
              return (
                <li key={item.id}>
                  <span>{item.name}</span>
                  {responsibility.kind === 'legacy' ? <small>{responsibility.label}</small> : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="mobile-crew-roster" aria-label="Crew responsibilities">
        {crew.length === 0 ? (
          <div className="mobile-crew-empty">
            <User size={24} aria-hidden="true" />
            <h2>No participants yet</h2>
            <p>Add a Crew member before assigning Gear or meal prep.</p>
            {onAdd ? <button type="button" onClick={openAdd}>Add first participant</button> : null}
          </div>
        ) : crew.map((member) => {
          const memberGear = getCrewGear(member.id, gear);
          const memberMeals = getCrewMeals(member.id, meals);
          const gearCount = memberGear.length;
          const mealCount = memberMeals.length;
          const isDeleting = pendingDeleteId === member.id;

          return (
            <article key={member.id} className="mobile-crew-person">
              <header>
                <div className="mobile-crew-person__avatar" aria-hidden="true">
                  {member.name.charAt(0).toUpperCase()}
                </div>
                <div className="mobile-crew-person__identity">
                  <h2>{member.name}</h2>
                  <p>{member.role || 'Participant'} · Canoe {member.canoe_number}</p>
                </div>
                {onUpdate || onDelete ? (
                  <div className="mobile-crew-person__actions">
                    {onUpdate ? (
                      <button type="button" onClick={() => openEdit(member)} aria-label={`Edit ${member.name}`}>
                        <Pencil size={15} aria-hidden="true" />
                      </button>
                    ) : null}
                    {onDelete ? (
                      <button type="button" data-tone="danger" onClick={() => setPendingDeleteId(member.id)} aria-label={`Remove ${member.name}`}>
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </header>

              {member.notes ? <p className="mobile-crew-person__notes">{member.notes}</p> : null}

              <section className="mobile-crew-responsibility" aria-labelledby={`crew-${member.id}-gear`}>
                <div className="mobile-crew-responsibility__heading">
                  <Backpack size={16} aria-hidden="true" />
                  <h3 id={`crew-${member.id}-gear`}>Gear</h3>
                  <span>{gearCount}</span>
                </div>
                {gearCount > 0 ? (
                  <ul>
                    {memberGear.map((item) => (
                      <li key={item.id}>
                        <span>{item.name}</span>
                        <small>
                          {item.priority === 'critical' ? 'Required · ' : ''}
                          {item.packed ? 'Packed' : item.acquired ? 'On hand' : 'Not acquired'}
                        </small>
                      </li>
                    ))}
                  </ul>
                ) : <p className="mobile-crew-responsibility__empty">No Gear responsibility</p>}
              </section>

              <section className="mobile-crew-responsibility" aria-labelledby={`crew-${member.id}-meals`}>
                <div className="mobile-crew-responsibility__heading">
                  <Utensils size={16} aria-hidden="true" />
                  <h3 id={`crew-${member.id}-meals`}>Meal prep</h3>
                  <span>{mealCount}</span>
                </div>
                {mealCount > 0 ? (
                  <ul>
                    {memberMeals.map((meal) => (
                      <li key={meal.id}>
                        <span>{meal.title}</span>
                        <small>Day {meal.day_number} · {meal.meal_type}</small>
                      </li>
                    ))}
                  </ul>
                ) : <p className="mobile-crew-responsibility__empty">No meal prep lead</p>}
              </section>

              <details className="mobile-crew-field-details">
                <summary><span>Field details</span><ChevronDown size={15} aria-hidden="true" /></summary>
                <dl>
                  <div><dt>Assigned systems</dt><dd>{member.load_item || 'None recorded'}</dd></div>
                  <div><dt>Carried load</dt><dd>{member.load_weight_kg} kg</dd></div>
                </dl>
              </details>

              {isDeleting ? (
                <div className="mobile-crew-delete" role="alert">
                  <p>
                    Remove <strong>{member.name}</strong>? {plural(gearCount, 'Gear item')} and {plural(mealCount, 'meal')} will become unassigned.
                  </p>
                  <div>
                    <button type="button" onClick={() => setPendingDeleteId(null)}>Cancel</button>
                    <button type="button" data-tone="danger" onClick={confirmDelete}>Remove</button>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </section>

      {crew.length > 0 ? (
        <section className="mobile-crew-load" aria-labelledby="mobile-crew-load-title">
          <Scale size={17} aria-hidden="true" />
          <div>
            <p>Secondary planning detail</p>
            <h2 id="mobile-crew-load-title">Load overview</h2>
          </div>
          <strong data-mobile-type-role="secondary-metric">{Math.round(totalLoad)} kg</strong>
        </section>
      ) : null}

      <CrewFormSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSubmit={saveMember}
        initialMember={editingMember}
      />
    </div>
  );
}
