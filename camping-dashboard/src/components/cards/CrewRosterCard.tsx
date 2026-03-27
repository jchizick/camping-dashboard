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

    const totalLoad = crew.reduce((acc, m) => acc + (m.load_weight_kg || 0), 0);
    const splitPercentages = crew.map(m => totalLoad > 0 ? Math.round(((m.load_weight_kg || 0) / totalLoad) * 100) : 0);
    const splitText = splitPercentages.length > 0 ? splitPercentages.join('% / ') + '%' : 'N/A';
    
    const maxDeviationPercent = totalLoad > 0 
        ? Math.max(...splitPercentages.map(p => Math.abs(p - (100 / crew.length))))
        : 0;
        
    let balanceStatus = "Optimal Balance";
    let statusColor = "#4CAF95";
    if (totalLoad === 0) {
        balanceStatus = "No Load Data";
        statusColor = "var(--text-muted)";
    } else if (maxDeviationPercent >= 20) {
        balanceStatus = "Major Imbalance";
        statusColor = "#ef4444";
    } else if (maxDeviationPercent >= 10) {
        balanceStatus = "Slight Imbalance";
        statusColor = "#f59e0b";
    }

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
                title="Mission Crew"
                icon="🧑‍🤝‍🧑"
                subtitle={`${crew.length}-Person Expedition`}
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
                        <span>⛺ Shelter System (Shared)</span>
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

            {crew.length > 0 && (
                <div className="crew-card__load-balance" style={{
                    margin: '1.5rem 1rem 0 1rem',
                    paddingTop: '1rem',
                    borderTop: '1px solid rgba(255,255,255,0.1)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
                        <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Load Balance ⚖️</span>
                    </div>
                    
                    <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: '1fr 1fr', 
                        gap: '1rem',
                        fontSize: '0.875rem',
                        marginBottom: '1rem'
                    }}>
                        <div>
                            <div style={{ color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Total Load</div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '1.125rem' }}>{Math.round(totalLoad)} kg</div>
                        </div>
                        <div>
                            <div style={{ color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Distribution</div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '1.125rem' }}>{splitText}</div>
                        </div>
                    </div>

                    <div>
                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            fontSize: '0.875rem',
                            marginBottom: '0.5rem'
                        }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Status:</span>
                            <span style={{ color: statusColor, fontWeight: 500 }}>{balanceStatus}</span>
                        </div>
                        <div style={{ 
                            display: 'flex', 
                            height: '10px', 
                            borderRadius: '5px', 
                            overflow: 'hidden', 
                            backgroundColor: 'rgba(255,255,255,0.05)',
                        }}>
                            {splitPercentages.map((pct, i) => (
                                <div 
                                    key={i} 
                                    style={{ 
                                        width: `${pct}%`, 
                                        backgroundColor: canoeColors[i % canoeColors.length],
                                        opacity: 0.85
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                </div>
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
