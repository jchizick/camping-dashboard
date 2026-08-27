'use client';

import React, { useState } from 'react';
import type { CrewMember, GearItem, Meal } from '@/types';
import { Badge, Card } from '@/components/ui/Primitives';
import { useTheme } from '@/lib/themeContext';
import CrewFormSheet from '@/components/cards/CrewFormSheet';
import { Pencil, Plus, Scale, Trash2, User } from 'lucide-react';

interface CrewRosterCardProps {
    crew: CrewMember[];
    onAdd?: (member: Omit<CrewMember, 'id' | 'trip_id'>) => Promise<void>;
    onUpdate?: (id: string, patch: Partial<Omit<CrewMember, 'id' | 'trip_id'>>) => Promise<void>;
    onDelete?: (id: string) => Promise<void>;
    gear?: GearItem[];
    meals?: Meal[];
}

const loadToneClasses = [
    'bg-accent-green',
    'bg-text-muted/75',
    'bg-accent-green/55',
    'bg-text-main/55',
];

export function splitResponsibilities(loadItem: string) {
    return loadItem.split(/\s*\+\s*/).map((item) => item.trim()).filter(Boolean);
}

function formatResponsibility(value: string) {
    if (value !== value.toUpperCase()) return value;
    return value.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function getCrewLoadRows(crew: CrewMember[]) {
    const totalLoad = crew.reduce((total, member) => total + (member.load_weight_kg || 0), 0);
    return {
        totalLoad,
        rows: crew.map((member) => {
            const weight = member.load_weight_kg || 0;
            const rawPercentage = totalLoad > 0 ? (weight / totalLoad) * 100 : 0;
            return { member, weight, rawPercentage, displayPercentage: Math.round(rawPercentage) };
        }),
    };
}

export default function CrewRosterCard({ crew, gear = [], meals = [], onAdd, onUpdate, onDelete }: CrewRosterCardProps) {
    const [sheetOpen, setSheetOpen] = useState(false);
    const [editingMember, setEditingMember] = useState<CrewMember | undefined>(undefined);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
    const { labels } = useTheme();
    const { totalLoad, rows: loadRows } = getCrewLoadRows(crew);

    const equalShare = crew.length > 0 ? 100 / crew.length : 0;
    const maxDeviationPercent = totalLoad > 0
        ? Math.max(...loadRows.map(({ rawPercentage }) => Math.abs(rawPercentage - equalShare)))
        : 0;

    let balanceStatus = 'Optimal Balance';
    let statusColor = 'text-accent-green';
    if (totalLoad === 0) {
        balanceStatus = 'No Load Data';
        statusColor = 'text-text-muted';
    } else if (maxDeviationPercent >= 20) {
        balanceStatus = 'Major Imbalance';
        statusColor = 'text-accent-red';
    } else if (maxDeviationPercent >= 10) {
        balanceStatus = 'Slight Imbalance';
        statusColor = 'text-accent-yellow';
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
        if (editingMember) await onUpdate?.(editingMember.id, data);
        else await onAdd?.(data);
    }

    async function confirmDelete() {
        if (!pendingDeleteId) return;
        await onDelete?.(pendingDeleteId);
        setPendingDeleteId(null);
    }

    return (
        <div className="crew-workspace flex flex-col gap-6">
            <section className="crew-roster-section space-y-4" aria-labelledby="crew-roster-heading">
                <div className="crew-roster-heading-row flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h2 id="crew-roster-heading" className="text-xs font-semibold uppercase tracking-wider text-text-muted">{labels.crew}</h2>
                        <p className="mt-1 text-sm text-text-main">
                            {crew.length} {crew.length === 1 ? 'member' : 'members'} assigned
                        </p>
                    </div>
                    {onAdd && (
                        <button
                            type="button"
                            onClick={openAdd}
                            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-border-subtle bg-card-bg px-4 text-sm font-semibold text-text-main transition-colors hover:border-accent-yellow/40 hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-yellow/60"
                        >
                            <Plus size={16} aria-hidden="true" /> Add crew member
                        </button>
                    )}
                </div>

                {pendingDeleteId && (() => {
                    const member = crew.find((candidate) => candidate.id === pendingDeleteId);
                    const gearCount = gear.filter((item) => item.responsible_crew_member_id === pendingDeleteId).length;
                    const mealCount = meals.filter((meal) => meal.prep_crew_member_id === pendingDeleteId).length;
                    return (
                        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent-red/20 bg-accent-red/10 p-3 text-sm text-accent-red">
                            <span>
                                Remove <strong>{member?.name ?? 'this member'}</strong>?{' '}
                                {gearCount} Gear {gearCount === 1 ? 'item' : 'items'} and {mealCount} {mealCount === 1 ? 'meal' : 'meals'} will become unassigned.
                            </span>
                            <div className="flex gap-2">
                                <button type="button" className="min-h-10 rounded-lg border border-border-subtle bg-card-bg px-3 text-xs text-text-muted hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-yellow/60" onClick={() => setPendingDeleteId(null)}>Cancel</button>
                                <button type="button" className="min-h-10 rounded-lg bg-accent-red px-3 text-xs font-bold text-bg-main hover:bg-accent-red/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red/60" onClick={confirmDelete}>Remove</button>
                            </div>
                        </div>
                    );
                })()}

                <div className="crew-roster-grid grid grid-cols-1 gap-6 md:grid-cols-2">
                {crew.length === 0 ? (
                    <Card title="Crew roster" icon={User} className="md:col-span-2">
                        <div className="flex min-h-40 flex-col items-center justify-center text-center">
                            <User size={28} className="mb-3 text-text-muted" aria-hidden="true" />
                            <p className="text-sm font-semibold text-text-main">No crew members yet</p>
                            <p className="mt-1 max-w-sm text-xs leading-relaxed text-text-muted">Add the first member to assign field responsibilities and track carried load.</p>
                        </div>
                    </Card>
                ) : crew.map((member) => {
                    const responsibilities = splitResponsibilities(member.load_item);
                    const loadRow = loadRows.find((row) => row.member.id === member.id);
                    return (
                        <Card
                            key={member.id}
                            title={member.name}
                            icon={User}
                            className="crew-member-card group"
                            action={(onUpdate || onDelete) && (
                                <div className="flex gap-1 opacity-70 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                                    {onUpdate && (
                                        <button type="button" className="flex size-10 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-border-subtle hover:text-accent-yellow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-yellow/60" onClick={() => openEdit(member)} aria-label={`Edit ${member.name}`}>
                                            <Pencil size={15} aria-hidden="true" />
                                        </button>
                                    )}
                                    {onDelete && (
                                        <button type="button" className="flex size-10 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-border-subtle hover:text-accent-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red/60" onClick={() => setPendingDeleteId(member.id)} aria-label={`Remove ${member.name}`}>
                                            <Trash2 size={15} aria-hidden="true" />
                                        </button>
                                    )}
                                </div>
                            )}
                        >
                            <div className="crew-member-card__identity flex items-start gap-4">
                                <div className="flex size-12 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-border-subtle font-mono text-base font-bold text-text-main" role="img" aria-label={`${member.name} avatar`}>
                                    <span>{member.name.charAt(0).toUpperCase()}</span>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-text-main">{member.role}</p>
                                    <div className="mt-2"><Badge>Canoe {member.canoe_number}</Badge></div>
                                </div>
                            </div>

                            {member.notes && <p className="crew-member-card__notes mt-5 border-l-2 border-border-subtle pl-3 text-xs italic leading-relaxed text-text-muted">{member.notes}</p>}

                            <div className="crew-member-card__systems mt-5">
                                <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-text-muted">Assigned systems</p>
                                {member.load_item.includes('+') ? (
                                    <div className="flex flex-wrap gap-2">
                                        {responsibilities.map((responsibility) => (
                                            <Badge key={responsibility} variant="warning">{formatResponsibility(responsibility)}</Badge>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs leading-relaxed text-text-main">
                                        {member.load_item ? formatResponsibility(member.load_item) : 'No system assigned'}
                                    </p>
                                )}
                            </div>

                            <div className="crew-member-card__metrics mt-6 grid grid-cols-2 gap-4 border-t border-border-subtle pt-4">
                                <div>
                                    <p className="text-[10px] uppercase tracking-wider text-text-muted">Carried load</p>
                                    <p className="mt-1 font-mono text-lg font-bold text-text-main">{loadRow?.weight ?? 0} kg</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] uppercase tracking-wider text-text-muted">Group load</p>
                                    <p className="mt-1 font-mono text-lg font-bold text-accent-yellow">{loadRow?.displayPercentage ?? 0}%</p>
                                </div>
                            </div>
                        </Card>
                    );
                })}
                </div>
            </section>

            <Card title="Expedition Load" icon={Scale} className="crew-load-card">
                <div className="crew-load-card__summary flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <p className="text-xs text-text-muted">Total carried load</p>
                        <p className="mt-1 font-mono text-2xl font-bold text-text-main">{Math.round(totalLoad)} kg</p>
                    </div>
                    <div className="text-left sm:text-right">
                        <p className="text-xs text-text-muted">Balance status</p>
                        <p className={`mt-1 text-sm font-semibold ${statusColor}`}>{balanceStatus}</p>
                    </div>
                </div>

                {loadRows.length > 0 ? (
                    <>
                        <div className="crew-load-card__rows mt-6 space-y-3">
                            {loadRows.map(({ member, weight, displayPercentage }, index) => (
                                <div key={member.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 text-sm">
                                    <div className="flex min-w-0 items-center gap-2">
                                        <span className={`crew-load-swatch size-2.5 shrink-0 rounded-sm ${loadToneClasses[index % loadToneClasses.length]}`} aria-hidden="true" />
                                        <span className="truncate font-medium text-text-main">{member.name}</span>
                                    </div>
                                    <span className="font-mono text-text-muted">{weight} kg</span>
                                    <span className="w-11 text-right font-mono font-bold text-text-main">{displayPercentage}%</span>
                                </div>
                            ))}
                        </div>

                        <div className="crew-load-distribution mt-5 flex h-4 overflow-hidden rounded-full border border-border-subtle bg-border-subtle/50" role="img" aria-label={`Load distribution: ${loadRows.map(({ member, displayPercentage }) => `${member.name} ${displayPercentage}%`).join(', ')}`}>
                            {loadRows.map(({ member, rawPercentage }, index) => (
                                <div
                                    key={member.id}
                                    style={{ width: `${rawPercentage}%` }}
                                    className={`crew-load-segment ${loadToneClasses[index % loadToneClasses.length]} ${index > 0 ? 'border-l-2 border-card-bg' : ''}`}
                                    aria-hidden="true"
                                />
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="mt-6 flex min-h-24 items-center justify-center rounded-xl border border-dashed border-border-subtle text-center">
                        <p className="max-w-md text-xs leading-relaxed text-text-muted">Load distribution will appear after crew members are added.</p>
                    </div>
                )}
            </Card>

            <CrewFormSheet isOpen={sheetOpen} onClose={() => setSheetOpen(false)} onSubmit={handleFormSubmit} initialMember={editingMember} />
        </div>
    );
}
