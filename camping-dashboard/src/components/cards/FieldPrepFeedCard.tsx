'use client';

import React, { useState } from 'react';
import type { PrepFeedItem, PrepFeedCategory } from '@/types';
import { Card, Badge } from '@/components/ui/Primitives';
import PrepFeedFormSheet from './PrepFeedFormSheet';
import PrepFeedLightbox from '@/components/ui/PrepFeedLightbox';
import { Camera, Plus, Trash2, Clock, User } from 'lucide-react';

// ── Category → badge variant mapping ────────────────────────
const CATEGORY_VARIANT: Record<PrepFeedCategory, string> = {
    'Gear': 'warning',
    'Food': 'success',
    'Shelter': 'info',
    'Cook Kit': 'warning',
    'Route': 'info',
    'Campsite': 'success',
    'Misc': 'default',
};

// ── Relative time helper ────────────────────────────────────
function timeAgo(dateStr: string): string {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diff = Math.max(0, now - then);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

// ── Props ───────────────────────────────────────────────────
interface FieldPrepFeedCardProps {
    items: PrepFeedItem[];
    onAdd?: (data: { file: File; caption: string; category: PrepFeedCategory; uploaded_by: string }) => Promise<void>;
    onDelete?: (id: string) => Promise<void>;
    defaultUploader?: string;
}

export default function FieldPrepFeedCard({ items, onAdd, onDelete, defaultUploader }: FieldPrepFeedCardProps) {
    const [sheetOpen, setSheetOpen] = useState(false);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

    async function confirmDelete() {
        if (!pendingDeleteId) return;
        await onDelete?.(pendingDeleteId);
        setPendingDeleteId(null);
    }

    return (
        <Card
            title="Field Prep Feed"
            icon={Camera}
            className="h-full"
            action={onAdd && (
                <button
                    onClick={() => setSheetOpen(true)}
                    className="p-1 hover:bg-card-hover rounded text-text-muted transition-colors"
                    aria-label="Log new asset"
                >
                    <Plus size={16} />
                </button>
            )}
        >
            {/* Delete confirmation */}
            {pendingDeleteId && (() => {
                const entry = items.find(i => i.id === pendingDeleteId);
                return (
                    <div className="bg-accent-red/10 border border-accent-red/20 text-accent-red p-3 mb-4 rounded-xl flex items-center justify-between text-sm">
                        <span>Delete <strong>{entry?.caption || 'this entry'}</strong>?</span>
                        <div className="flex gap-2">
                            <button className="px-3 py-1 bg-card-bg rounded border border-border-subtle hover:bg-card-hover text-text-muted text-xs" onClick={() => setPendingDeleteId(null)}>Cancel</button>
                            <button className="px-3 py-1 bg-accent-red text-bg-main rounded hover:bg-accent-red/80 font-bold text-xs" onClick={confirmDelete}>Delete</button>
                        </div>
                    </div>
                );
            })()}

            {/* Feed body — scrollable */}
            <div className="prep-feed-scroll">
                {items.length === 0 ? (
                    <div
                        className="flex flex-col items-center justify-center p-8 text-sm text-text-muted font-mono bg-card-bg/50 border border-border-subtle border-dashed rounded-xl cursor-pointer hover:border-accent-yellow/40 transition-colors"
                        onClick={onAdd ? () => setSheetOpen(true) : undefined}
                        role={onAdd ? 'button' : undefined}
                        tabIndex={onAdd ? 0 : undefined}
                    >
                        <Camera size={28} className="mb-2 opacity-40" />
                        <span>No field assets logged</span>
                        {onAdd && <span className="text-[10px] text-accent-yellow mt-1 uppercase tracking-wider">Click to upload</span>}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {items.map((item) => {
                            const isExpanded = expandedId === item.id;
                            return (
                                <div
                                    key={item.id}
                                    className="prep-feed-entry group"
                                >
                                    {/* Thumbnail */}
                                    <button
                                        type="button"
                                        className="prep-feed-entry__thumb-wrap"
                                        onClick={() => setLightboxIndex(items.indexOf(item))}
                                        aria-label={`View ${item.caption || item.category}`}
                                    >
                                        <img
                                            src={item.image_url}
                                            alt={item.caption || item.category}
                                            className="prep-feed-entry__thumb"
                                            loading="lazy"
                                        />
                                    </button>

                                    {/* Details */}
                                    <div className="prep-feed-entry__details">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                {item.caption ? (
                                                    <p
                                                        className={`text-sm text-text-main leading-snug ${isExpanded ? '' : 'line-clamp-2'} cursor-pointer`}
                                                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                                                        title={isExpanded ? 'Collapse' : 'Expand'}
                                                    >
                                                        {item.caption}
                                                    </p>
                                                ) : (
                                                    <p className="text-sm text-text-muted italic">No caption</p>
                                                )}
                                            </div>
                                            <Badge variant={CATEGORY_VARIANT[item.category] || 'default'}>
                                                {item.category}
                                            </Badge>
                                        </div>

                                        {/* Meta row */}
                                        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-text-muted uppercase tracking-wider">
                                            <span className="flex items-center gap-1">
                                                <User size={10} /> {item.uploaded_by}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Clock size={10} /> {timeAgo(item.created_at)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Delete button */}
                                    {onDelete && (
                                        <button
                                            onClick={() => setPendingDeleteId(item.id)}
                                            className="absolute top-2 right-2 p-1.5 text-text-muted hover:text-accent-red hover:bg-black/20 rounded transition-all opacity-0 group-hover:opacity-100"
                                            aria-label="Delete entry"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Count footer */}
            {items.length > 0 && (
                <div className="mt-4 pt-3 border-t border-border-subtle text-[10px] text-text-muted uppercase tracking-wider font-mono text-center">
                    {items.length} asset{items.length !== 1 ? 's' : ''} logged
                </div>
            )}

            {onAdd && (
                <PrepFeedFormSheet
                    isOpen={sheetOpen}
                    onClose={() => setSheetOpen(false)}
                    onSubmit={onAdd}
                    defaultUploader={defaultUploader}
                />
            )}

            {lightboxIndex !== null && (
                <PrepFeedLightbox
                    items={items}
                    currentIndex={lightboxIndex}
                    onClose={() => setLightboxIndex(null)}
                    onNavigate={(i) => setLightboxIndex(i)}
                />
            )}
        </Card>
    );
}
