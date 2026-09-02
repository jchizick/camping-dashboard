'use client';

import React, { useState, useMemo } from 'react';
import type { CrewMember, GearItem } from '@/types';
import { resolveCrewResponsibility } from '@/lib/crewResponsibility';
import {
    calculateEstimatedGearWeight,
    formatEstimatedGearWeight,
    groupBy,
} from '@/lib/helpers';
import type { ReadinessCategoryResult } from '@/lib/readiness';
import { useTheme } from '@/lib/themeContext';
import { Card, ProgressBar } from '@/components/ui/Primitives';
import ChecklistItem from '@/components/ui/ChecklistItem';
import GearFormSheet from '@/components/cards/GearFormSheet';
import { AlertTriangle, CheckCircle2, ChevronDown, Plus, ShieldCheck, Tent, Weight } from 'lucide-react';

interface GearChecklistCardProps {
    gear: GearItem[];
    categoryReadiness: ReadinessCategoryResult;
    onToggle?: (id: string) => void;
    onTogglePacked?: (id: string) => void;
    onAdd?: (item: Omit<GearItem, 'id' | 'trip_id'>) => Promise<void>;
    onUpdate?: (id: string, patch: Partial<Omit<GearItem, 'id' | 'trip_id'>>) => Promise<void>;
    onDelete?: (id: string) => Promise<void>;
    crew?: CrewMember[];
    addIntent?: 'required' | null;
    onAddIntentConsumed?: () => void;
}

type FilterMode = 'all' | 'to-pack' | 'required';

const CATEGORY_ORDER = [
    'Shelter',
    'Navigation',
    'Cooking',
    'Safety',
    'Clothing',
    'Lighting',
    'Camp',
    'Admin',
    'Extras',
];

interface RequiredGearBrief {
    tone: 'coverage' | 'blocker' | 'warning' | 'ready';
    title: string;
    detail: string;
}

function itemCount(count: number, noun: string) {
    return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function requiredGearBrief(category: ReadinessCategoryResult): RequiredGearBrief {
    if (category.availability !== 'scored') {
        return {
            tone: 'coverage',
            title: 'Required gear not identified',
            detail: 'Mark the gear you must have so Field Protocol can assess readiness.',
        };
    }

    const blockerCount = category.issues.filter((issue) => issue.severity === 'blocker').length;
    const warningCount = category.issues.filter((issue) => issue.severity === 'warning').length;

    if (blockerCount > 0) {
        return {
            tone: 'blocker',
            title: `${itemCount(blockerCount, 'required item')} missing`,
            detail: warningCount > 0
                ? `${itemCount(warningCount, 'acquired required item')} still ${warningCount === 1 ? 'needs' : 'need'} packing.`
                : 'Acquire or replace the missing gear before departure.',
        };
    }

    if (warningCount > 0) {
        return {
            tone: 'warning',
            title: `${itemCount(warningCount, 'required item')} still ${warningCount === 1 ? 'needs' : 'need'} packing`,
            detail: 'These items are on hand but are not physically packed yet.',
        };
    }

    return {
        tone: 'ready',
        title: 'Required gear ready',
        detail: 'Every identified Required item is packed.',
    };
}

export default function GearChecklistCard({ gear, crew = [], categoryReadiness, onToggle, onTogglePacked, onAdd, onUpdate, onDelete, addIntent = null, onAddIntentConsumed }: GearChecklistCardProps) {
    const [filter, setFilter] = useState<FilterMode>('all');
    const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<GearItem | undefined>(undefined);
    const [createAsRequired, setCreateAsRequired] = useState(false);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
    const consumedAddIntentRef = React.useRef(false);

    React.useEffect(() => {
        if (addIntent !== 'required' || consumedAddIntentRef.current) return;
        consumedAddIntentRef.current = true;
        onAddIntentConsumed?.();
        if (!onAdd) return;
        setEditingItem(undefined);
        setCreateAsRequired(true);
        setSheetOpen(true);
    }, [addIntent, onAdd, onAddIntentConsumed]);

    const estimatedGearWeight = useMemo(
        () => formatEstimatedGearWeight(calculateEstimatedGearWeight(gear)),
        [gear]
    );

    const filtered = useMemo(() => {
        if (filter === 'to-pack') return gear.filter((g) => !g.packed);
        if (filter === 'required') return gear.filter((g) => g.priority === 'critical');
        return gear;
    }, [gear, filter]);

    const grouped = useMemo(() => {
        const normalizedGear = filtered.map(g => {
            const rawCat = g.category || 'Extras';
            const cat = rawCat.charAt(0).toUpperCase() + rawCat.slice(1).toLowerCase();
            return { ...g, category: cat };
        });
        return groupBy(normalizedGear, (g) => g.category);
    }, [filtered]);

    const packedCount = gear.filter((g) => g.packed).length;
    const packingPercent = gear.length === 0 ? 0 : Math.round((packedCount / gear.length) * 100);
    const readiness = categoryReadiness.score;
    const requiredBrief = requiredGearBrief(categoryReadiness);
    const emptyFilterMessage = filter === 'all'
        ? 'No gear added yet.'
        : filter === 'to-pack'
          ? 'Everything on this list is packed.'
          : 'No Required gear identified.';

    function openAdd(required = false) {
        setEditingItem(undefined);
        setCreateAsRequired(required);
        setSheetOpen(true);
    }

    function openEdit(item: GearItem) {
        setEditingItem(item);
        setCreateAsRequired(false);
        setSheetOpen(true);
    }

    async function handleFormSubmit(data: Omit<GearItem, 'id' | 'trip_id'>) {
        if (editingItem) {
            await onUpdate?.(editingItem.id, data);
        } else {
            await onAdd?.(data);
        }
    }

    async function confirmDelete() {
        if (!pendingDeleteId) return;
        await onDelete?.(pendingDeleteId);
        setPendingDeleteId(null);
    }

    const readinessColor = readiness !== null && readiness >= 80
        ? 'bg-accent-green'
        : readiness !== null && readiness >= 50
          ? 'bg-accent-yellow'
          : 'bg-accent-red';
    const { labels } = useTheme();

    return (
        <Card 
            title={labels.gear} 
            icon={Tent} 
            className="gear-checklist-card h-full min-h-0 flex flex-col"
            action={onAdd && (
                <button type="button" aria-label="Add gear item" onClick={() => openAdd(false)} className="flex size-10 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-yellow/60">
                    <Plus size={16} aria-hidden="true" />
                </button>
            )}
        >
            <section className="gear-mobile-brief shrink-0 md:hidden" aria-label="Packing and Required gear status">
                <div className="gear-mobile-brief__metrics">
                    <div className="gear-mobile-brief__packing">
                        <span className="gear-mobile-brief__label">Packing progress</span>
                        <strong data-mobile-type-role="packing-metric">
                            {packedCount} <span>/ {gear.length}</span>
                        </strong>
                        <span className="gear-mobile-brief__caption">planned items packed</span>
                    </div>
                    <div className="gear-mobile-brief__weight">
                        <Weight size={16} aria-hidden="true" />
                        <span className="gear-mobile-brief__label">Estimated weight</span>
                        <strong data-mobile-type-role="secondary-metric">{estimatedGearWeight}</strong>
                    </div>
                </div>
                <div
                    className="gear-mobile-brief__packing-progress"
                    data-state={packingPercent === 100 ? 'complete' : 'pending'}
                    role="progressbar"
                    aria-label="Overall packing progress"
                    aria-valuemin={0}
                    aria-valuemax={gear.length}
                    aria-valuenow={packedCount}
                    aria-valuetext={`${packedCount} of ${gear.length} planned items packed`}
                >
                    <span style={{ width: `${packingPercent}%` }} />
                </div>
                <div className="gear-mobile-brief__required" data-tone={requiredBrief.tone}>
                    {requiredBrief.tone === 'ready' ? (
                        <CheckCircle2 size={19} aria-hidden="true" />
                    ) : requiredBrief.tone === 'coverage' ? (
                        <ShieldCheck size={19} aria-hidden="true" />
                    ) : (
                        <AlertTriangle size={19} aria-hidden="true" />
                    )}
                    <div>
                        <span className="gear-mobile-brief__label">Required readiness</span>
                        <h2>{requiredBrief.title}</h2>
                        <p>{requiredBrief.detail}</p>
                    </div>
                    {requiredBrief.tone === 'blocker' || requiredBrief.tone === 'warning' ? (
                        <button
                            type="button"
                            onClick={() => {
                                setFilter('required');
                                setExpandedCategory(null);
                            }}
                        >
                            Show required
                        </button>
                    ) : requiredBrief.tone === 'coverage' && onAdd ? (
                        <button type="button" onClick={() => openAdd(true)}>Add required gear</button>
                    ) : null}
                </div>
            </section>

            <div className="gear-desktop-summary mb-4 hidden shrink-0 items-start justify-between gap-3 md:flex">
                <div>
                    <div className="text-2xl font-mono text-text-main">
                        {packedCount} / {gear.length} <span className="text-sm text-text-muted font-sans">packed</span>
                    </div>
                </div>
                <div className="w-1/2">
                    <div className="text-xs font-mono text-text-muted mb-1 flex justify-between">
                        <span>Gear readiness</span>
                        <span className="text-text-main">
                            {readiness === null ? 'Unavailable' : `${readiness}%`}
                        </span>
                    </div>
                    {readiness === null ? (
                        <div className="h-2 rounded-full bg-border-subtle" aria-hidden="true" />
                    ) : (
                        <ProgressBar value={readiness} colorClass={readinessColor} />
                    )}
                </div>
            </div>

            <div className="gear-filter-bar mb-6 flex shrink-0 items-center gap-2 border-b border-border-subtle pb-4">
                <div className="gear-filter-bar__options flex min-w-0 gap-2" role="group" aria-label="Gear checklist filters">
                    {(['all', 'to-pack', 'required'] as FilterMode[]).map((f) => {
                        const isActive = filter === f;

                        return (
                            <button
                                key={f}
                                type="button"
                                data-filter={f}
                                aria-pressed={isActive}
                                className={`flex min-h-10 items-center gap-2 rounded-full border px-4 text-xs font-mono transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-yellow/60 ${
                                    isActive
                                        ? 'bg-border-subtle text-text-main border-border-subtle'
                                        : 'bg-card-bg text-text-muted border-border-subtle hover:bg-card-hover'
                                }`}
                                onClick={() => setFilter(f)}
                            >
                                {f === 'all' ? null : (
                                    <span
                                        className={`gear-filter-marker size-2 rounded-full ${f === 'required' ? 'gear-filter-marker--required' : 'gear-filter-marker--to-pack'}`}
                                        aria-hidden="true"
                                    />
                                )}
                                {f === 'all' ? 'All' : f === 'to-pack' ? 'To pack' : 'Required'}
                            </button>
                        );
                    })}
                </div>
                <div className="gear-desktop-weight ml-auto hidden min-h-10 shrink-0 items-center rounded-lg border border-border-subtle bg-card-hover px-3 font-mono text-[11px] text-text-muted md:flex">
                    Total estimated gear weight: {estimatedGearWeight}
                </div>
            </div>

            {pendingDeleteId && (() => {
                const item = gear.find(g => g.id === pendingDeleteId);
                return (
                    <div className="bg-accent-red/10 border border-accent-red/20 text-accent-red p-3 mb-4 rounded-xl flex items-center justify-between text-sm shrink-0">
                        <span>Remove <strong>{item?.name ?? 'this item'}</strong>?</span>
                        <div className="flex gap-2">
                            <button type="button" className="min-h-10 rounded border border-border-subtle bg-card-bg px-3 text-xs text-text-muted hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-yellow/60" onClick={() => setPendingDeleteId(null)}>Cancel</button>
                            <button type="button" className="min-h-10 rounded bg-accent-red px-3 text-xs font-bold text-bg-main hover:bg-accent-red/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red/60" onClick={confirmDelete}>Remove</button>
                        </div>
                    </div>
                );
            })()}

            <div
                className="gear-checklist-card__items space-y-6 overflow-y-auto pr-2 custom-scrollbar flex-1 min-h-0 pb-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring"
                role="region"
                aria-label="Gear checklist categories and items"
                tabIndex={0}
            >
                {Object.entries(grouped)
                    .sort(([a], [b]) => {
                        const ai = CATEGORY_ORDER.indexOf(a);
                        const bi = CATEGORY_ORDER.indexOf(b);
                        const aIdx = ai === -1 ? CATEGORY_ORDER.indexOf('Extras') - 0.5 : ai;
                        const bIdx = bi === -1 ? CATEGORY_ORDER.indexOf('Extras') - 0.5 : bi;
                        return aIdx - bIdx;
                    })
                    .map(([category, items]) => (
                    <div key={category}>
                        <button
                            type="button"
                            className="group mb-3 flex min-h-10 w-full items-center justify-between rounded-lg px-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-yellow/60"
                            onClick={() => setExpandedCategory(expandedCategory === category ? null : category)}
                            aria-expanded={expandedCategory === category || expandedCategory === null}
                            aria-controls={`gear-category-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                        >
                            <span className="text-xs font-bold tracking-widest text-text-muted uppercase transition-colors group-hover:text-text-main">
                                {category}
                            </span>
                            <span className="flex items-center gap-2 text-xs font-mono text-text-muted transition-colors group-hover:text-text-main">
                                {items.filter((i) => i.packed).length}/{items.length}
                                <ChevronDown aria-hidden="true" size={14} className={`transform transition-transform ${expandedCategory === category || expandedCategory === null ? 'rotate-180' : ''}`} />
                            </span>
                        </button>
                        {(expandedCategory === category || expandedCategory === null) && (
                            <div id={`gear-category-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`} className="space-y-1">
                                {items.map((item) => {
                                    const responsibility = resolveCrewResponsibility(
                                        item.responsible_crew_member_id,
                                        item.owner,
                                        crew
                                    );
                                    return <ChecklistItem
                                        key={item.id}
                                        item={item}
                                        onToggle={onToggle}
                                        onTogglePacked={onTogglePacked}
                                        onEdit={onUpdate ? () => openEdit(item) : undefined}
                                        onDelete={onDelete ? () => setPendingDeleteId(item.id) : undefined}
                                        responsibilityLabel={responsibility.label}
                                        responsibilityKind={responsibility.kind}
                                    />
                                })}
                            </div>
                        )}
                    </div>
                ))}
                {filtered.length === 0 && (
                    <div className="py-8 text-center font-mono text-sm text-text-muted opacity-70">
                        {emptyFilterMessage}
                    </div>
                )}
            </div>

            <GearFormSheet
                isOpen={sheetOpen}
                onClose={() => setSheetOpen(false)}
                onSubmit={handleFormSubmit}
                initialItem={editingItem}
                crew={crew}
                defaultRequired={createAsRequired}
            />
        </Card>
    );
}
