'use client';

import React from 'react';
import type { GearItem } from '@/types';
import { CheckCircle2, Circle, Pencil, Trash2 } from 'lucide-react';

interface ChecklistItemProps {
    item: GearItem;
    onToggle?: (id: string) => void;
    onTogglePacked?: (id: string) => void;
    onEdit?: (item: GearItem) => void;
    onDelete?: (id: string) => void;
}

export default function ChecklistItem({ item, onToggle, onTogglePacked, onEdit, onDelete }: ChecklistItemProps) {
    return (
        <div className="group flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-card-hover focus-within:bg-card-hover/50">
            <button
                type="button"
                className="flex min-h-10 flex-1 cursor-pointer items-center gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-yellow/60 disabled:cursor-default"
                onClick={() => onToggle?.(item.id)}
                disabled={!onToggle}
                aria-label={`${item.name} — ${item.acquired ? 'acquired' : 'not acquired'}`}
                aria-pressed={item.acquired}
            >
                {item.acquired ? (
                    <CheckCircle2 size={16} className="text-accent-green shrink-0" />
                ) : item.priority === 'critical' ? (
                    <Circle size={16} className="text-accent-red shrink-0" />
                ) : item.priority === 'low' ? (
                    <Circle size={16} className="text-accent-green shrink-0" />
                ) : (
                    <Circle size={16} className="text-accent-yellow shrink-0" />
                )}
                
                <span className={`text-sm ${item.acquired ? 'text-text-muted line-through' : 'text-text-main'}`}>
                    {item.name}
                </span>

                <div className="flex items-center gap-2 ml-2">
                    {item.owner && (
                        <div className="text-[10px] uppercase tracking-wider bg-border-subtle px-2 py-0.5 rounded text-text-muted">
                            {item.owner}
                        </div>
                    )}
                    {item.weight_kg > 0 && (
                        <span className="text-[10px] font-mono text-text-muted">{item.weight_kg}kg</span>
                    )}
                </div>
            </button>

            {/* Packed indicator — independent from left readiness circle */}
            <button
                type="button"
                className={`flex size-10 shrink-0 items-center justify-center rounded-md text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-yellow/60 ${
                    item.packed
                        ? 'opacity-90 hover:opacity-100'
                        : 'opacity-30 hover:opacity-60'
                } ${onTogglePacked ? 'cursor-pointer hover:bg-card-hover' : 'cursor-default'}`}
                onClick={(e) => { e.stopPropagation(); onTogglePacked?.(item.id); }}
                disabled={!onTogglePacked}
                aria-label={item.packed ? 'Packed' : 'Mark as packed'}
                title={item.packed ? 'Packed' : 'Mark as packed'}
            >
                {item.packed ? '🎒' : '—'}
            </button>

            {/* Action zone — edit / delete */}
            {(onEdit || onDelete) && (
                <div className="ml-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                    {onEdit && (
                        <button
                            type="button"
                            className="flex size-10 items-center justify-center rounded text-text-muted transition-colors hover:bg-border-subtle hover:text-accent-yellow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-yellow/60"
                            onClick={(e) => { e.stopPropagation(); onEdit(item); }}
                            aria-label={`Edit ${item.name}`}
                            title="Edit item"
                        >
                            <Pencil size={14} aria-hidden="true" />
                        </button>
                    )}
                    {onDelete && (
                        <button
                            type="button"
                            className="flex size-10 items-center justify-center rounded text-text-muted transition-colors hover:bg-border-subtle hover:text-accent-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red/60"
                            onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                            aria-label={`Delete ${item.name}`}
                            title="Delete item"
                        >
                            <Trash2 size={14} aria-hidden="true" />
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
