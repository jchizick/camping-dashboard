'use client';

import React, { useState } from 'react';
import type { CrewMember } from '@/types';
import GlassCard from '@/components/ui/GlassCard';
import SectionHeader from '@/components/ui/SectionHeader';
import CrewFormSheet from '@/components/cards/CrewFormSheet';

interface CrewRosterCardProps {
    crew: CrewMember[];
    onAdd?: (member: Omit<CrewMember, 'id' | 'trip_id'>) => Promise<void>;
    onUpdate?: (id: string, patch: Partial<Omit<CrewMember, 'id' | 'trip_id'>>) => Promise<void>;
    onDelete?: (id: string) => Promise<void>;
}

const canoeColors = ['#C9A455', '#4CAF95', '#7B9BD0'];

export default function CrewRosterCard({ crew, onAdd, onUpdate, onDelete }: CrewRosterCardProps) {
    const [sheetOpen, setSheetOpen] = useState(false);
    const [editingMember, setEditingMember] = useState<CrewMember | undefined>(undefined);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

    const canoeGroups = crew.reduce<Record<number, CrewMember[]>>((acc, m) => {
        if (!acc[m.canoe_number]) acc[m.canoe_number] = [];
        acc[m.canoe_number].push(m);
        return acc;
    }, {});

    function openAdd() {
        setEditingMember(undefined);
        setSheetOpen(true);
    }

    function openEdit(member: CrewMember) {
        setEditingMember(member);
        setSheetOpen(true);
    }

    async function handleFormSubmit(data: Omit<CrewMember, 'id' | 'trip_id'>) {
        if (editingMember) {
            await onUpdate?.(editingMember.id, data);
        } else {
            await onAdd?.(data);
        }
    }

    function handleDelete(id: string) {
        setPendingDeleteId(id);
    }

    async function confirmDelete() {
        if (!pendingDeleteId) return;
        await onDelete?.(pendingDeleteId);
        setPendingDeleteId(null);
    }

    return (
        <GlassCard className="crew-card">
            <SectionHeader
                title="Crew Roster"
                icon="🧑‍🤝‍🧑"
                subtitle={`${crew.length} paddlers`}
                onAdd={onAdd ? openAdd : undefined}
                addLabel="Add crew member"
            />


            {pendingDeleteId && (() => {
                const member = crew.find(m => m.id === pendingDeleteId);
                return (
                    <div className="gear-card__delete-confirm">
                        <span>Remove <strong>{member?.name ?? 'this member'}</strong> from the crew?</span>
                        <div className="gear-card__delete-confirm-actions">
                            <button className="gear-card__delete-confirm-btn gear-card__delete-confirm-btn--cancel" onClick={() => setPendingDeleteId(null)}>Cancel</button>
                            <button className="gear-card__delete-confirm-btn gear-card__delete-confirm-btn--confirm" onClick={confirmDelete}>Remove</button>
                        </div>
                    </div>
                );
            })()}

            {Object.entries(canoeGroups).map(([canoeNum, members]) => (
                <div key={canoeNum} className="crew-card__canoe">
                    <div
                        className="crew-card__canoe-header"
                        style={{ borderColor: canoeColors[parseInt(canoeNum) - 1] }}
                    >
                        <span>🛶 Canoe {canoeNum}</span>
                    </div>
                    {members.map((member) => (
                        <div key={member.id} className="crew-card__member">
                            <div className="crew-card__member-avatar">
                                {member.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="crew-card__member-info">
                                <p className="crew-card__member-name">{member.name}</p>
                                <p className="crew-card__member-role">{member.role}</p>
                                {member.notes && (
                                    <p className="crew-card__member-notes">{member.notes}</p>
                                )}
                            </div>
                            <div className="crew-card__member-load">
                                <p className="crew-card__load-item">{member.load_item}</p>
                                <p className="crew-card__load-weight">{member.load_weight_kg} kg</p>
                            </div>
                            {(onUpdate || onDelete) && (
                                <div className="row-actions">
                                    {onUpdate && (
                                        <button
                                            className="row-actions__btn row-actions__btn--edit"
                                            onClick={() => openEdit(member)}
                                            aria-label={`Edit ${member.name}`}
                                            title="Edit member"
                                        >
                                            ✏️
                                        </button>
                                    )}
                                    {onDelete && (
                                        <button
                                            className="row-actions__btn row-actions__btn--delete"
                                            onClick={() => handleDelete(member.id)}
                                            aria-label={`Remove ${member.name}`}
                                            title="Remove member"
                                        >
                                            🗑️
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ))}

            {crew.length === 0 && (
                <p className="crew-card__empty">No crew members yet</p>
            )}

            <CrewFormSheet
                isOpen={sheetOpen}
                onClose={() => setSheetOpen(false)}
                onSubmit={handleFormSubmit}
                initialMember={editingMember}
            />
        </GlassCard>
    );
}
