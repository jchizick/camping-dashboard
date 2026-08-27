'use client';

import React from 'react';
import type { GearItem } from '@/types';
import { Backpack, CheckCircle2, Circle, Pencil, Trash2 } from 'lucide-react';

interface ChecklistItemProps {
    item: GearItem;
    onToggle?: (id: string) => void;
    onTogglePacked?: (id: string) => void;
    onEdit?: (item: GearItem) => void;
    onDelete?: (id: string) => void;
    responsibilityLabel?: string;
    responsibilityKind?: 'resolved' | 'legacy' | 'unassigned';
}

export default function ChecklistItem({ item, onToggle, onTogglePacked, onEdit, onDelete, responsibilityLabel, responsibilityKind }: ChecklistItemProps) {
    const isRequired = item.priority === 'critical';
    const itemState = item.packed
        ? 'packed'
        : isRequired && !item.acquired
          ? 'missing'
          : isRequired
            ? 'needs-packing'
            : 'optional';
    const stateLabel = item.packed
        ? 'Packed'
        : isRequired && !item.acquired
          ? 'Missing · Not acquired'
          : isRequired
            ? 'On hand · Needs packing'
            : item.acquired
              ? 'On hand'
              : 'Not acquired';

    return (
        <div
            className="gear-checklist-item group flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-card-hover focus-within:bg-card-hover/50"
            data-required={isRequired ? 'true' : 'false'}
            data-item-state={itemState}
        >
            <button
                type="button"
                className="gear-checklist-item__acquired flex min-h-10 min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-yellow/60 disabled:cursor-default"
                onClick={() => onToggle?.(item.id)}
                disabled={!onToggle}
                aria-label={`${item.name} — ${item.acquired ? 'on hand' : 'not acquired'}`}
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
                
                <div className="gear-checklist-item__copy min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className={`gear-checklist-item__name text-sm ${item.packed ? 'text-text-muted line-through decoration-text-muted/50' : 'text-text-main'}`}>
                            {item.name}
                        </span>
                        {isRequired ? (
                            <span className="gear-checklist-item__required rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                                Required
                            </span>
                        ) : null}
                    </div>
                    <span className="gear-checklist-item__state">{stateLabel}</span>
                    <div className="gear-checklist-item__meta flex flex-wrap items-center gap-2">
                        {responsibilityLabel && responsibilityKind !== 'unassigned' ? (
                            <span className="rounded bg-border-subtle px-2 py-0.5 text-[10px] uppercase tracking-wider text-text-muted">
                                {responsibilityLabel}
                            </span>
                        ) : null}
                        {item.weight_kg > 0 ? (
                            <span className="font-mono text-[10px] text-text-muted">{item.weight_kg}kg</span>
                        ) : null}
                    </div>
                </div>
            </button>

            <button
                type="button"
                className={`gear-checklist-item__pack flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-md px-2 text-sm transition-[background-color,color,opacity,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-yellow/60 ${
                    item.packed
                        ? 'opacity-90 hover:opacity-100'
                        : 'opacity-30 hover:opacity-60'
                } ${onTogglePacked ? 'cursor-pointer hover:bg-card-hover' : 'cursor-default'}`}
                onClick={(e) => { e.stopPropagation(); onTogglePacked?.(item.id); }}
                disabled={!onTogglePacked}
                aria-label={`${item.name} — ${item.packed ? 'packed' : 'not packed'}`}
                aria-pressed={item.packed}
                title={item.packed ? 'Mark as unpacked' : 'Mark as packed'}
            >
                <Backpack size={16} aria-hidden="true" />
                <span className="gear-checklist-item__pack-label">{item.packed ? 'Packed' : 'Pack'}</span>
            </button>

            {(onEdit || onDelete) && (
                <div className="gear-checklist-item__actions ml-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
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
