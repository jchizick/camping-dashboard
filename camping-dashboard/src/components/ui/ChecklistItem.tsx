'use client';

import React from 'react';
import type { GearItem } from '@/types';
import StatusPill from './StatusPill';

interface ChecklistItemProps {
    item: GearItem;
    onToggle?: (id: string) => void;
    onEdit?: (item: GearItem) => void;
    onDelete?: (id: string) => void;
}

const priorityDot: Record<string, string> = {
    critical: '🔴',
    high: '🟡',
    low: '🟢',
};

export default function ChecklistItem({ item, onToggle, onEdit, onDelete }: ChecklistItemProps) {
    return (
        <div
            className={`checklist-item ${item.packed ? 'checklist-item--packed' : 'checklist-item--needed'}`}
        >
            {/* Toggle zone — clicking here packs/unpacks */}
            <div
                className="checklist-item__toggle"
                role="button"
                tabIndex={0}
                onClick={() => onToggle?.(item.id)}
                onKeyDown={(e) => e.key === 'Enter' && onToggle?.(item.id)}
                aria-label={`${item.name} — ${item.packed ? 'packed' : 'not packed'}`}
            >
                <span className="checklist-item__check">{item.packed ? '✓' : '○'}</span>
                <span className="checklist-item__priority">{priorityDot[item.priority]}</span>
                <span className="checklist-item__name">{item.name}</span>
                <div className="checklist-item__meta">
                    {item.owner && (
                        <StatusPill label={item.owner} variant="ok" size="sm" />
                    )}
                    {item.weight_kg > 0 && (
                        <span className="checklist-item__weight">{item.weight_kg}kg</span>
                    )}
                </div>
            </div>

            {/* Action zone — edit / delete */}
            {(onEdit || onDelete) && (
                <div className="row-actions">
                    {onEdit && (
                        <button
                            className="row-actions__btn row-actions__btn--edit"
                            onClick={() => onEdit(item)}
                            aria-label={`Edit ${item.name}`}
                            title="Edit item"
                        >
                            ✏️
                        </button>
                    )}
                    {onDelete && (
                        <button
                            className="row-actions__btn row-actions__btn--delete"
                            onClick={() => onDelete(item.id)}
                            aria-label={`Delete ${item.name}`}
                            title="Delete item"
                        >
                            🗑️
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
