'use client';

import React, { useState } from 'react';
import type { CrewMember, GearItem, Priority } from '@/types';
import { getCrewSelectOptions } from '@/lib/crewResponsibility';
import CrudSheet from '@/components/ui/CrudSheet';
import { draftValuesEqual, useTripDraftForm } from '@/components/trip/useTripDraftForm';

interface GearFormSheetProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: Omit<GearItem, 'id' | 'trip_id'>) => Promise<void>;
    initialItem?: GearItem;
    crew?: CrewMember[];
    defaultRequired?: boolean;
}

type GearFormData = Omit<GearItem, 'id' | 'trip_id'>;

const defaultForm: GearFormData = {
    name: '',
    category: '',
    priority: 'high' as Priority,
    owner: null,
    responsible_crew_member_id: null,
    weight_kg: 0,
    notes: '',
    acquired: false,
    packed: false,
};

function createDefaultForm(defaultRequired: boolean): GearFormData {
    return {
        ...defaultForm,
        priority: defaultRequired ? 'critical' : 'high',
    };
}

export default function GearFormSheet({ isOpen, onClose, onSubmit, initialItem, crew = [], defaultRequired = false }: GearFormSheetProps) {
    const draftId = React.useId();
    const blankForm = React.useMemo(
        () => createDefaultForm(defaultRequired),
        [defaultRequired]
    );
    const [form, setForm] = useState<GearFormData>(initialItem ?? blankForm);
    const [nonRequiredPriority, setNonRequiredPriority] = useState<'high' | 'low'>(
        initialItem?.priority === 'low' ? 'low' : 'high'
    );
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    function set<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
        setForm((prev) => ({ ...prev, [key]: val }));
    }

    // Reset form when sheet opens with new item
    React.useEffect(() => {
        if (isOpen) {
            setForm(initialItem ?? createDefaultForm(defaultRequired));
            setNonRequiredPriority(initialItem?.priority === 'low' ? 'low' : 'high');
            setError(null);
        }
    }, [defaultRequired, isOpen, initialItem]);

    const initialForm = initialItem ?? blankForm;
    const { close, saved } = useTripDraftForm({
        id: `gear-${draftId}`,
        isOpen,
        isDirty: !draftValuesEqual(form, initialForm),
        onClose,
        onDiscard: () => setForm(initialForm),
    });

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!form.name.trim()) { setError('Name is required'); return; }
        setSaving(true);
        try {
            await onSubmit({
                ...form,
                owner: form.responsible_crew_member_id ? null : form.owner,
            });
            saved();
            onClose();
        } catch {
            setError('Failed to save. Please try again.');
        } finally {
            setSaving(false);
        }
    }

    const isEdit = !!initialItem;
    const isRequired = form.priority === 'critical';
    const crewOptions = getCrewSelectOptions(crew);

    function setRequired(required: boolean) {
        set('priority', required ? 'critical' : nonRequiredPriority);
    }

    function setPackingPriority(priority: 'high' | 'low') {
        setNonRequiredPriority(priority);
        set('priority', priority);
    }

    return (
        <CrudSheet isOpen={isOpen} onClose={close} title={isEdit ? 'Edit Gear Item' : 'Add Gear Item'} surface="workspace">
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
                        aria-invalid={error ? 'true' : undefined}
                        aria-describedby={error ? 'gear-form-error' : undefined}
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

                <div className="crud-form__field crud-form__field--checkbox gear-required-control">
                    <input
                        id="gear-required"
                        className="crud-form__checkbox"
                        type="checkbox"
                        checked={isRequired}
                        onChange={(e) => setRequired(e.target.checked)}
                    />
                    <label className="gear-required-control__label" htmlFor="gear-required">
                        <span className="crud-form__label">Required for this trip</span>
                        <small>Required items determine Gear readiness.</small>
                    </label>
                </div>

                <div className="crud-form__row">
                    <div className="crud-form__field">
                        <label className="crud-form__label" htmlFor="gear-priority">Packing priority</label>
                        <select
                            id="gear-priority"
                            className="crud-form__select"
                            value={nonRequiredPriority}
                            onChange={(e) => setPackingPriority(e.target.value as 'high' | 'low')}
                            disabled={isRequired}
                            aria-describedby={isRequired ? 'gear-priority-required-note' : undefined}
                        >
                            <option value="high">High</option>
                            <option value="low">Low</option>
                        </select>
                        {isRequired ? (
                            <small id="gear-priority-required-note" className="gear-required-control__note">
                                Required items take precedence over packing priority.
                            </small>
                        ) : null}
                    </div>

                    <div className="crud-form__field">
                        <label className="crud-form__label" htmlFor="gear-responsible">Responsible</label>
                        <select
                            id="gear-responsible"
                            className="crud-form__select"
                            value={form.responsible_crew_member_id ?? ''}
                            onChange={(e) => setForm((current) => ({
                                ...current,
                                responsible_crew_member_id: e.target.value || null,
                                owner: null,
                            }))}
                        >
                            <option value="">Unassigned</option>
                            {crewOptions.map((option) => (
                                <option key={option.id} value={option.id}>{option.label}</option>
                            ))}
                        </select>
                        {form.responsible_crew_member_id === null && form.owner?.trim() ? (
                            <small className="gear-required-control__note">
                                Legacy assignment: {form.owner.trim()}. Choose Crew to resolve it.
                            </small>
                        ) : null}
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
                        id="gear-acquired"
                        className="crud-form__checkbox"
                        type="checkbox"
                        checked={form.acquired}
                        onChange={(e) => set('acquired', e.target.checked)}
                    />
                    <label className="crud-form__label" htmlFor="gear-acquired">Acquired / on-hand</label>
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

                {error && <p id="gear-form-error" className="crud-form__error" role="alert">{error}</p>}

                <div className="crud-form__actions">
                    <button type="button" className="crud-form__btn crud-form__btn--cancel" onClick={close}>
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
