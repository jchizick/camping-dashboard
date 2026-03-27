'use client';

import React, { useState } from 'react';
import type { CrewMember } from '@/types';
import CrudSheet from '@/components/ui/CrudSheet';

interface CrewFormSheetProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: Omit<CrewMember, 'id' | 'trip_id'>) => Promise<void>;
    initialMember?: CrewMember;
}

const defaultForm = {
    name: '',
    role: '',
    load_item: '',
    load_weight_kg: 0,
    canoe_number: 1,
    notes: '',
};

export default function CrewFormSheet({ isOpen, onClose, onSubmit, initialMember }: CrewFormSheetProps) {
    const [form, setForm] = useState(initialMember ?? defaultForm);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    function set<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
        setForm((prev) => ({ ...prev, [key]: val }));
    }

    React.useEffect(() => {
        if (isOpen) {
            setForm(initialMember ?? defaultForm);
            setError(null);
        }
    }, [isOpen, initialMember]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!form.name.trim()) { setError('Name is required'); return; }
        setSaving(true);
        try {
            await onSubmit(form);
            onClose();
        } catch {
            setError('Failed to save. Please try again.');
        } finally {
            setSaving(false);
        }
    }

    const isEdit = !!initialMember;

    return (
        <CrudSheet isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Crew Member' : 'Add Crew Member'}>
            <form className="crud-form" onSubmit={handleSubmit} noValidate>

                <div className="crud-form__field">
                    <label className="crud-form__label" htmlFor="crew-name">Name *</label>
                    <input
                        id="crew-name"
                        className="crud-form__input"
                        type="text"
                        value={form.name}
                        onChange={(e) => set('name', e.target.value)}
                        placeholder="e.g. Jordan"
                        required
                    />
                </div>

                <div className="crud-form__row">
                    <div className="crud-form__field">
                        <label className="crud-form__label" htmlFor="crew-role">Role</label>
                        <input
                            id="crew-role"
                            className="crud-form__input"
                            type="text"
                            value={form.role}
                            onChange={(e) => set('role', e.target.value)}
                            placeholder="e.g. Navigator"
                        />
                    </div>

                    <div className="crud-form__field">
                        <label className="crud-form__label" htmlFor="crew-canoe">Canoe #</label>
                        <select
                            id="crew-canoe"
                            className="crud-form__select"
                            value={form.canoe_number}
                            onChange={(e) => set('canoe_number', parseInt(e.target.value))}
                        >
                            <option value={1}>Canoe 1</option>
                            <option value={2}>Canoe 2</option>
                            <option value={3}>Canoe 3</option>
                        </select>
                    </div>
                </div>

                <div className="crud-form__row">
                    <div className="crud-form__field">
                        <label className="crud-form__label" htmlFor="crew-load">Load Item</label>
                        <input
                            id="crew-load"
                            className="crud-form__input"
                            type="text"
                            value={form.load_item}
                            onChange={(e) => set('load_item', e.target.value)}
                            placeholder="e.g. Food barrel"
                        />
                    </div>

                    <div className="crud-form__field">
                        <label className="crud-form__label" htmlFor="crew-weight">Load (kg)</label>
                        <input
                            id="crew-weight"
                            className="crud-form__input"
                            type="number"
                            min="0"
                            step="0.5"
                            value={form.load_weight_kg}
                            onChange={(e) => set('load_weight_kg', parseFloat(e.target.value) || 0)}
                        />
                    </div>
                </div>

                <div className="crud-form__field">
                    <label className="crud-form__label" htmlFor="crew-notes">Notes</label>
                    <textarea
                        id="crew-notes"
                        className="crud-form__textarea"
                        value={form.notes}
                        onChange={(e) => set('notes', e.target.value)}
                        rows={2}
                        placeholder="Optional notes…"
                    />
                </div>

                {error && <p className="crud-form__error">{error}</p>}

                <div className="crud-form__actions">
                    <button type="button" className="crud-form__btn crud-form__btn--cancel" onClick={onClose}>Cancel</button>
                    <button type="submit" className="crud-form__btn crud-form__btn--save" disabled={saving}>
                        {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Member'}
                    </button>
                </div>
            </form>
        </CrudSheet>
    );
}
