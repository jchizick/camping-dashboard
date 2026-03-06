'use client';

import React from 'react';
import type { GearItem } from '@/types';
import StatusPill from './StatusPill';

interface ChecklistItemProps {
    item: GearItem;
    onToggle?: (id: string) => void;
}

const priorityDot: Record<string, string> = {
    critical: '🔴',
    high: '🟡',
    low: '🟢',
};

export default function ChecklistItem({ item, onToggle }: ChecklistItemProps) {
    return (
        <div
            className={`checklist-item ${item.packed ? 'checklist-item--packed' : 'checklist-item--needed'}`}
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
    );
}
