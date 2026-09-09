'use client';

import React, { useEffect, useState } from 'react';
import type { TripMapStyle } from '@/types';
import CampsiteMapSelector, { type CampsiteSelection } from './CampsiteMapSelector';
import CrudSheet from '@/components/ui/CrudSheet';
import { usePhoneLayout } from '@/components/trip/PhoneLayoutProvider';
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
    const isPhoneLayout = usePhoneLayout();
    const [selection, setSelection] = useState<CampsiteSelection | null>(initialValue);
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen || isPhoneLayout || !document.querySelector('[data-desktop-workspace-document]')) return;
        const panel = document.querySelector('.campsite-location-sheet');
        if (!panel) return;
        // The SDK geocoder exposes no CSS parts; keep its shadow styles local and
        // conditional on the same desktop contract as the portaled sheet theme.
        const themeSearch = () => {
            const root = panel.querySelector('maptiler-geocoder')?.shadowRoot;
            if (!root || root.querySelector('[data-workspace-search-theme]')) return;
            const style = document.createElement('style');
            style.dataset.workspaceSearchTheme = '';
            style.textContent = `
              form[class] {
                background: var(--app-bg); border: 1px solid var(--workspace-border-strong);
                box-shadow: none; font-family: var(--font-ui-face), sans-serif;
                --color-text: var(--workspace-text-primary); --color-icon-button: var(--workspace-text-secondary);
              }
              input[placeholder] {
                color: var(--workspace-text-primary); background: transparent; font-size: 16px;
              }
              input[placeholder]::placeholder { color: var(--workspace-text-secondary); }
              form[class]:focus-within { outline: 2px solid var(--workspace-text-primary); outline-offset: 2px; }
            `;
            root.append(style);
        };
        themeSearch();
        const observer = new MutationObserver(themeSearch);
        observer.observe(panel, { childList: true, subtree: true });
        return () => {
            observer.disconnect();
            panel.querySelector('maptiler-geocoder')?.shadowRoot?.querySelector('[data-workspace-search-theme]')?.remove();
        };
    }, [isOpen, isPhoneLayout]);

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
            surface="workspace"
            panelClassName="max-w-3xl campsite-location-sheet"
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

                    <div className="campsite-location-sheet__coordinates type-technical mt-4 rounded-lg border border-border-subtle bg-app-bg/50 p-3 text-xs text-text-muted" aria-live="polite">
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
