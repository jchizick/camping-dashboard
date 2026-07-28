'use client';

import React, { useState } from 'react';
import type { AlertSeverity } from '@/types';
import CrudSheet from '@/components/ui/CrudSheet';
import { draftValuesEqual, useTripDraftForm } from '@/components/trip/useTripDraftForm';

interface AlertFormSheetProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: { title: string; body: string; severity: AlertSeverity; source: string; is_active: boolean }) => Promise<void>;
}

const defaultForm = {
    title: '',
    body: '',
    severity: 'info' as AlertSeverity,
};

export default function AlertFormSheet({ isOpen, onClose, onSubmit }: AlertFormSheetProps) {
    const draftId = React.useId();
    const [form, setForm] = useState(defaultForm);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    function set<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
        setForm((prev) => ({ ...prev, [key]: val }));
    }

    React.useEffect(() => {
        if (isOpen) {
            setForm(defaultForm);
            setError(null);
        }
    }, [isOpen]);

    const { close, saved } = useTripDraftForm({
        id: `alert-${draftId}`,
        isOpen,
        isDirty: !draftValuesEqual(form, defaultForm),
        onClose,
        onDiscard: () => setForm(defaultForm),
    });

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!form.title.trim()) { setError('Title is required'); return; }
        setSaving(true);
        try {
            await onSubmit({
                ...form,
                source: 'manual',
                is_active: true,
            });
            saved();
            onClose();
        } catch {
            setError('Failed to save. Please try again.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <CrudSheet isOpen={isOpen} onClose={close} title="Add Note / Alert">
            <form className="crud-form" onSubmit={handleSubmit} noValidate>

                <div className="crud-form__field">
                    <label className="crud-form__label" htmlFor="alert-title">Title *</label>
                    <input
                        id="alert-title"
                        className="crud-form__input"
                        type="text"
                        value={form.title}
                        onChange={(e) => set('title', e.target.value)}
                        placeholder="e.g. Check portage conditions"
                        required
                        aria-invalid={error ? 'true' : undefined}
                        aria-describedby={error ? 'alert-form-error' : undefined}
                    />
                </div>

                <div className="crud-form__field">
                    <label className="crud-form__label" htmlFor="alert-body">Message</label>
                    <textarea
                        id="alert-body"
                        className="crud-form__textarea"
                        value={form.body}
                        onChange={(e) => set('body', e.target.value)}
                        rows={3}
                        placeholder="Details or instructions…"
                    />
                </div>

                <div className="crud-form__field">
                    <label className="crud-form__label" htmlFor="alert-severity">Severity</label>
                    <select
                        id="alert-severity"
                        className="crud-form__select"
                        value={form.severity}
                        onChange={(e) => set('severity', e.target.value as AlertSeverity)}
                    >
                        <option value="info">ℹ️ Info</option>
                        <option value="advisory">Advisory</option>
                        <option value="watch">Watch</option>
                        <option value="warning">⚠️ Warning</option>
                        <option value="critical">🚨 Critical</option>
                    </select>
                </div>

                {error && <p id="alert-form-error" className="crud-form__error" role="alert">{error}</p>}

                <div className="crud-form__actions">
                    <button type="button" className="crud-form__btn crud-form__btn--cancel" onClick={close}>Cancel</button>
                    <button type="submit" className="crud-form__btn crud-form__btn--save" disabled={saving}>
                        {saving ? 'Saving…' : 'Add Note'}
                    </button>
                </div>
            </form>
        </CrudSheet>
    );
}
