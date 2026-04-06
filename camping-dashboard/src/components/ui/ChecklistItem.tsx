'use client';

import React from 'react';
import type { GearItem } from '@/types';
import { Badge } from '@/components/ui/Primitives';
import { CheckCircle2, Circle, Pencil, Trash2 } from 'lucide-react';

interface ChecklistItemProps {
    item: GearItem;
    onToggle?: (id: string) => void;
    onEdit?: (item: GearItem) => void;
    onDelete?: (id: string) => void;
}

export default function ChecklistItem({ item, onToggle, onEdit, onDelete }: ChecklistItemProps) {
    return (
        <div className="flex items-center justify-between p-2 hover:bg-card-hover rounded-lg group transition-colors">
            <div 
                className="flex items-center gap-3 cursor-pointer flex-1"
                role="button"
                tabIndex={0}
                onClick={() => onToggle?.(item.id)}
                onKeyDown={(e) => e.key === 'Enter' && onToggle?.(item.id)}
                aria-label={`${item.name} — ${item.packed ? 'packed' : 'not packed'}`}
            >
                {item.packed ? (
                    <CheckCircle2 size={16} className="text-accent-green shrink-0" />
                ) : item.priority === 'critical' ? (
                    <Circle size={16} className="text-accent-red shrink-0" />
                ) : item.priority === 'low' ? (
                    <Circle size={16} className="text-accent-green shrink-0" />
                ) : (
                    <Circle size={16} className="text-accent-yellow shrink-0" />
                )}
                
                <span className={`text-sm ${item.packed ? 'text-text-muted line-through' : 'text-text-main'}`}>
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
            </div>

            {/* Action zone — edit / delete */}
            {(onEdit || onDelete) && (
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity ml-4">
                    {onEdit && (
                        <button
                            className="p-1 hover:bg-border-subtle rounded text-text-muted hover:text-accent-yellow transition-colors"
                            onClick={(e) => { e.stopPropagation(); onEdit(item); }}
                            aria-label={`Edit ${item.name}`}
                            title="Edit item"
                        >
                            <Pencil size={14} />
                        </button>
                    )}
                    {onDelete && (
                        <button
                            className="p-1 hover:bg-border-subtle rounded text-text-muted hover:text-accent-red transition-colors"
                            onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                            aria-label={`Delete ${item.name}`}
                            title="Delete item"
                        >
                            <Trash2 size={14} />
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
