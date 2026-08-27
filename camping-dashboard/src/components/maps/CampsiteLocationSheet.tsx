'use client';

import React, { useEffect, useState } from 'react';
import type { TripMapStyle } from '@/types';
import CampsiteMapSelector, { type CampsiteSelection } from './CampsiteMapSelector';
import CrudSheet from '@/components/ui/CrudSheet';
import { draftValuesEqual, useTripDraftForm } from '@/components/trip/useTripDraftForm';

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
    const draftId = React.useId();
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

    const { close, saved } = useTripDraftForm({
        id: `campsite-${draftId}`,
        isOpen,
        isDirty: dirty && !draftValuesEqual(selection, initialValue),
        onClose,
        onDiscard: () => {
            setSelection(initialValue);
            setDirty(false);
        },
    });

    if (!isOpen) return null;

    async function handleSave() {
        if (!selection || saving) return;
        setSaving(true);
        setError(null);
        try {
            await onSave(selection);
            saved();
            onClose();
        } catch (saveError) {
            console.error('[CampsiteLocationSheet] Save failed', saveError);
            setError(saveError instanceof Error ? saveError.message : 'The campsite location could not be saved.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <CrudSheet
            isOpen={isOpen}
            onClose={close}
            title={initialValue ? 'Reposition campsite' : 'Set campsite location'}
            panelClassName="max-w-3xl"
        >
                    {isProvisional && (
                        <p className="mb-4 text-xs text-accent-yellow">
                            This location was imported from legacy data. Refine it before relying on it.
                        </p>
                    )}
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

                    <div className="type-technical mt-4 rounded-lg border border-border-subtle bg-app-bg/50 p-3 text-xs text-text-muted" aria-live="polite">
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

                    {error && <p className="crud-form__error mt-3" role="alert">{error}</p>}

                    <div className="crud-form__actions mt-5">
                        <button className="crud-form__btn crud-form__btn--cancel" onClick={close} disabled={saving}>
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
        </CrudSheet>
    );
}
