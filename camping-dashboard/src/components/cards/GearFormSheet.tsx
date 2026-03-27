'use client';

import React, { useState } from 'react';
import type { GearItem, Priority } from '@/types';
import CrudSheet from '@/components/ui/CrudSheet';

interface GearFormSheetProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: Omit<GearItem, 'id' | 'trip_id'>) => Promise<void>;
    initialItem?: GearItem;
}

const defaultForm = {
    name: '',
    category: '',
    priority: 'high' as Priority,
    owner: '',
    weight_kg: 0,
    notes: '',
    packed: false,
};

export default function GearFormSheet({ isOpen, onClose, onSubmit, initialItem }: GearFormSheetProps) {
    const [form, setForm] = useState(initialItem ?? defaultForm);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    function set<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
        setForm((prev) => ({ ...prev, [key]: val }));
    }

    // Reset form when sheet opens with new item
    React.useEffect(() => {
        if (isOpen) {
            setForm(initialItem ?? defaultForm);
            setError(null);
        }
    }, [isOpen, initialItem]);

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

    const isEdit = !!initialItem;

    return (
        <CrudSheet isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Gear Item' : 'Add Gear Item'}>
            <form className="crud-form" onSubmit={handleSubmit} noValidate>

                <div className="crud-form__field">
                    <label className="crud-form__label" htmlFor="gear-name">Item Name *</label>
                    <input
                        id="gear-name"
                        className="crud-form__input"
                        type="text"
                        value={form.name}
                        onChange={(e) => set('name', e.target.value)}
                        placeholder="e.g. Sleeping Bag"
                        required
                    />
                </div>

                <div className="crud-form__field">
                    <label className="crud-form__label" htmlFor="gear-category">Category</label>
                    <input
                        id="gear-category"
                        className="crud-form__input"
                        type="text"
                        value={form.category}
                        onChange={(e) => set('category', e.target.value)}
                        placeholder="e.g. Sleep, Cook, Safety"
                    />
                </div>

                <div className="crud-form__row">
                    <div className="crud-form__field">
                        <label className="crud-form__label" htmlFor="gear-priority">Priority</label>
                        <select
                            id="gear-priority"
                            className="crud-form__select"
                            value={form.priority}
                            onChange={(e) => set('priority', e.target.value as Priority)}
                        >
                            <option value="critical">🔴 Critical</option>
                            <option value="high">🟡 High</option>
                            <option value="low">🟢 Low</option>
                        </select>
                    </div>

                    <div className="crud-form__field">
                        <label className="crud-form__label" htmlFor="gear-owner">Owner</label>
                        <input
                            id="gear-owner"
                            className="crud-form__input"
                            type="text"
                            value={form.owner}
                            onChange={(e) => set('owner', e.target.value)}
                            placeholder="e.g. Jordan"
                        />
                    </div>
                </div>

                <div className="crud-form__field">
                    <label className="crud-form__label" htmlFor="gear-weight">Weight (kg)</label>
                    <input
                        id="gear-weight"
                        className="crud-form__input"
                        type="number"
                        min="0"
                        step="0.1"
                        value={form.weight_kg}
                        onChange={(e) => set('weight_kg', parseFloat(e.target.value) || 0)}
                    />
                </div>

                <div className="crud-form__field">
                    <label className="crud-form__label" htmlFor="gear-notes">Notes</label>
                    <textarea
                        id="gear-notes"
                        className="crud-form__textarea"
                        value={form.notes}
                        onChange={(e) => set('notes', e.target.value)}
                        rows={2}
                        placeholder="Optional notes…"
                    />
                </div>

                <div className="crud-form__field crud-form__field--checkbox">
                    <input
                        id="gear-packed"
                        className="crud-form__checkbox"
                        type="checkbox"
                        checked={form.packed}
                        onChange={(e) => set('packed', e.target.checked)}
                    />
                    <label className="crud-form__label" htmlFor="gear-packed">Already packed</label>
                </div>

                {error && <p className="crud-form__error">{error}</p>}

                <div className="crud-form__actions">
                    <button type="button" className="crud-form__btn crud-form__btn--cancel" onClick={onClose}>
                        Cancel
                    </button>
                    <button type="submit" className="crud-form__btn crud-form__btn--save" disabled={saving}>
                        {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Item'}
                    </button>
                </div>
            </form>
        </CrudSheet>
    );
}
