'use client';

import React, { useState } from 'react';
import type { CrewMember } from '@/types';
import { Card } from '@/components/ui/Primitives';
import CrewFormSheet from '@/components/cards/CrewFormSheet';
import { User, Plus, Tent, Scale, Pencil, Trash2 } from 'lucide-react';

interface CrewRosterCardProps {
    crew: CrewMember[];
    onAdd?: (member: Omit<CrewMember, 'id' | 'trip_id'>) => Promise<void>;
    onUpdate?: (id: string, patch: Partial<Omit<CrewMember, 'id' | 'trip_id'>>) => Promise<void>;
    onDelete?: (id: string) => Promise<void>;
}

const canoeColors = ['bg-accent-yellow', 'bg-accent-green', 'bg-accent-blue', 'bg-text-main'];
const canoeBorderColors = ['border-accent-yellow', 'border-accent-green', 'border-accent-blue', 'border-text-main'];

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
    let statusColor = "text-accent-green";
    if (totalLoad === 0) {
        balanceStatus = "No Load Data";
        statusColor = "text-text-muted";
    } else if (maxDeviationPercent >= 20) {
        balanceStatus = "Major Imbalance";
        statusColor = "text-accent-red";
    } else if (maxDeviationPercent >= 10) {
        balanceStatus = "Slight Imbalance";
        statusColor = "text-accent-yellow";
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

    async function confirmDelete() {
        if (!pendingDeleteId) return;
        await onDelete?.(pendingDeleteId);
        setPendingDeleteId(null);
    }

    return (
        <Card 
            title="Mission Crew" 
            icon={User} 
            className="h-full flex flex-col"
            action={onAdd && (
                <button onClick={openAdd} className="p-1 hover:bg-card-hover rounded text-text-muted transition-colors">
                    <Plus size={16} />
                </button>
            )}
        >
            <div className="text-sm text-text-muted mb-6">{crew.length}-Person Expedition</div>

            {pendingDeleteId && (() => {
                const member = crew.find(m => m.id === pendingDeleteId);
                return (
                    <div className="bg-accent-red/10 border border-accent-red/20 text-accent-red p-3 mb-4 rounded-xl flex items-center justify-between text-sm shrink-0">
                        <span>Remove <strong>{member?.name ?? 'this member'}</strong>?</span>
                        <div className="flex gap-2">
                            <button className="px-3 py-1 bg-card-bg rounded border border-border-subtle hover:bg-card-hover text-text-muted text-xs" onClick={() => setPendingDeleteId(null)}>Cancel</button>
                            <button className="px-3 py-1 bg-accent-red text-bg-main rounded hover:bg-accent-red/80 font-bold text-xs" onClick={confirmDelete}>Remove</button>
                        </div>
                    </div>
                );
            })()}

            <div className="space-y-6 flex-1 overflow-y-auto custom-scrollbar pr-2 min-h-[250px]">
                {crew.length === 0 ? (
                    <div className="text-center text-sm text-text-muted py-8 font-mono opacity-50">
                        No team members added yet
                    </div>
                ) : (
                    Object.entries(canoeGroups).map(([canoeNum, members], idx) => {
                        const styleIdx = (parseInt(canoeNum) - 1) % canoeColors.length;
                        return (
                            <div key={canoeNum} className="space-y-4 relative">
                                <div className={`flex items-center gap-2 text-xs font-bold tracking-widest text-text-muted uppercase mb-4 border-b pb-2 ${canoeBorderColors[styleIdx]}`}>
                                    <Tent size={14} className={canoeBorderColors[styleIdx].replace('border', 'text')} /> Shelter System (Shared)
                                </div>
                                
                                {members.map((member) => (
                                    <div key={member.id} className="group relative flex gap-4 p-2 -mx-2 rounded hover:bg-card-hover/30 transition-colors">
                                        <div className="w-10 h-10 rounded-full bg-border-subtle flex items-center justify-center font-mono font-bold text-text-main shrink-0 border border-border-subtle overflow-hidden relative">
                                            <span className="absolute z-0">{member.name.charAt(0).toUpperCase()}</span>
                                            <img
                                                src={`/avatars/${member.name.charAt(0).toUpperCase()}.png`}
                                                alt={member.name}
                                                className="absolute inset-0 w-full h-full object-cover z-10"
                                                onError={(e) => {
                                                    e.currentTarget.style.display = 'none';
                                                }}
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start mb-1">
                                                <div>
                                                    <div className="text-sm font-bold text-text-main">{member.name}</div>
                                                    <div className="text-xs text-text-muted">{member.role}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-[10px] text-text-muted uppercase pr-[2px]">{member.load_item}</div>
                                                    <div className="text-sm font-mono text-accent-yellow font-bold mt-1 opacity-100 group-hover:opacity-0 transition-opacity">
                                                        {member.load_weight_kg || 0} kg
                                                    </div>
                                                </div>
                                            </div>
                                            {member.notes && <p className="text-xs text-text-muted italic mt-2 leading-relaxed">{member.notes}</p>}
                                        </div>
                                        
                                        {(onUpdate || onDelete) && (
                                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 bg-card-bg/80 backdrop-blur rounded pl-2">
                                                {onUpdate && (
                                                    <button className="p-1.5 text-text-muted hover:text-accent-yellow hover:bg-border-subtle rounded transition-colors shadow-lg" onClick={() => openEdit(member)}>
                                                        <Pencil size={14} />
                                                    </button>
                                                )}
                                                {onDelete && (
                                                    <button className="p-1.5 text-text-muted hover:text-accent-red hover:bg-border-subtle rounded transition-colors shadow-lg" onClick={() => setPendingDeleteId(member.id)}>
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        );
                    })
                )}
            </div>

            {crew.length > 0 && (
                <div className="mt-6 pt-6 border-t border-border-subtle shrink-0">
                    <div className="flex items-center gap-2 text-sm font-bold text-text-main mb-4">
                        Load Balance <Scale size={16} className={statusColor} />
                    </div>
                    <div className="flex justify-between items-end mb-4">
                        <div>
                            <div className="text-xs text-text-muted mb-1">Total Load</div>
                            <div className="text-xl font-mono text-text-main font-bold">{Math.round(totalLoad)} kg</div>
                        </div>
                        <div className="text-right">
                            <div className="text-xs text-text-muted mb-1">Distribution</div>
                            <div className="text-xl font-mono text-text-main font-bold">{splitText}</div>
                        </div>
                    </div>
                    
                    <div className="flex justify-between items-center text-sm mb-2">
                        <span className="text-text-muted">Status:</span>
                        <span className={`${statusColor} font-medium`}>{balanceStatus}</span>
                    </div>
                    
                    <div className="flex h-2.5 rounded-full overflow-hidden bg-border-subtle/50">
                        {splitPercentages.map((pct, i) => (
                            <div 
                                key={i} 
                                style={{ width: `${pct}%` }} 
                                className={`${canoeColors[i % canoeColors.length]} opacity-85 hover:opacity-100 transition-opacity`}
                            />
                        ))}
                    </div>
                </div>
            )}

            <CrewFormSheet
                isOpen={sheetOpen}
                onClose={() => setSheetOpen(false)}
                onSubmit={handleFormSubmit}
                initialMember={editingMember}
            />
        </Card>
    );
}
