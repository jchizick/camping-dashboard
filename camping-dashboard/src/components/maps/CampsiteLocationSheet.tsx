'use client';

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { TripMapStyle } from '@/types';
import CampsiteMapSelector, { type CampsiteSelection } from './CampsiteMapSelector';

interface CampsiteLocationSheetProps {
    isOpen: boolean;
    initialValue: CampsiteSelection | null;
    mapStyle: TripMapStyle | null;
    isProvisional?: boolean;
    onClose: () => void;
    onSave: (selection: CampsiteSelection) => Promise<void>;
}

export default function CampsiteLocationSheet({
    isOpen,
    initialValue,
    mapStyle,
    isProvisional = false,
    onClose,
    onSave,
}: CampsiteLocationSheetProps) {
    const [selection, setSelection] = useState<CampsiteSelection | null>(initialValue);
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        setSelection(initialValue);
        setDirty(false);
        setError(null);
    }, [initialValue, isOpen]);

    if (!isOpen) return null;

    async function handleSave() {
        if (!selection || saving) return;
        setSaving(true);
        setError(null);
        try {
            await onSave(selection);
            onClose();
        } catch (saveError) {
            console.error('[CampsiteLocationSheet] Save failed', saveError);
            setError(saveError instanceof Error ? saveError.message : 'The campsite location could not be saved.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="crud-sheet" role="dialog" aria-modal="true" aria-label="Edit campsite location">
            <button className="crud-sheet__overlay" onClick={onClose} aria-label="Close campsite editor" />
            <div className="crud-sheet__panel max-w-3xl">
                <div className="crud-sheet__header">
                    <div>
                        <h2 className="crud-sheet__title">
                            {initialValue ? 'Reposition campsite' : 'Set campsite location'}
                        </h2>
                        {isProvisional && (
                            <p className="mt-1 text-xs text-accent-yellow">
                                This location was imported from legacy data. Refine it before relying on it.
                            </p>
                        )}
                    </div>
                    <button className="crud-sheet__close" onClick={onClose} aria-label="Close">
                        <X size={18} />
                    </button>
                </div>

                <div className="crud-sheet__body">
                    <CampsiteMapSelector
                        value={selection}
                        onChange={(nextSelection) => {
                            setSelection(nextSelection);
                            setDirty(true);
                        }}
                        mapStyle={mapStyle}
                        visible={isOpen}
                        className="h-[430px] min-h-[320px]"
                    />

                    <div className="mt-4 rounded-lg border border-border-subtle bg-app-bg/50 p-3 font-mono text-xs text-text-muted" aria-live="polite">
                        {selection ? (
                            <>
                                Latitude <span className="text-text-main">{selection.latitude.toFixed(6)}</span>
                                {' · '}
                                Longitude <span className="text-text-main">{selection.longitude.toFixed(6)}</span>
                            </>
                        ) : (
                            'Search for an area, then click the map to place the campsite marker.'
                        )}
                    </div>

                    {error && <p className="crud-form__error mt-3">{error}</p>}

                    <div className="crud-form__actions mt-5">
                        <button className="crud-form__btn crud-form__btn--cancel" onClick={onClose} disabled={saving}>
                            Cancel
                        </button>
                        <button
                            className="crud-form__btn crud-form__btn--save"
                            onClick={handleSave}
                            disabled={!selection || !dirty || saving}
                        >
                            {saving ? 'Saving…' : 'Save location'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
