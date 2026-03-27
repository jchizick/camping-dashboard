'use client';

import React, { useState } from 'react';
import type { ParkIntel } from '@/types';
import CrudSheet from '@/components/ui/CrudSheet';

interface ParkIntelFormSheetProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (patch: Partial<Omit<ParkIntel, 'id' | 'trip_id' | 'updated_at'>>) => Promise<void>;
    intel: ParkIntel;
}

export default function ParkIntelFormSheet({ isOpen, onClose, onSubmit, intel }: ParkIntelFormSheetProps) {
    const [form, setForm] = useState({
        fire_restriction: intel.fire_restriction,
        wildlife_notes: intel.wildlife_notes,
        ranger_station: intel.ranger_station,
        firewood_percent: intel.firewood_percent,
        water_notes: intel.water_notes,
        custom_notes: intel.custom_notes,
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Sync form when sheet opens with fresh intel data
    React.useEffect(() => {
        if (isOpen) {
            setForm({
                fire_restriction: intel.fire_restriction,
                wildlife_notes: intel.wildlife_notes,
                ranger_station: intel.ranger_station,
                firewood_percent: intel.firewood_percent,
                water_notes: intel.water_notes,
                custom_notes: intel.custom_notes,
            });
            setError(null);
        }
    }, [isOpen, intel]);

    function set<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
        setForm((prev) => ({ ...prev, [key]: val }));
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
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

    return (
        <CrudSheet isOpen={isOpen} onClose={onClose} title="Edit Park Intelligence">
            <form className="crud-form" onSubmit={handleSubmit} noValidate>

                <div className="crud-form__field">
                    <label className="crud-form__label" htmlFor="park-fire">🔥 Fire Restriction Status</label>
                    <input
                        id="park-fire"
                        className="crud-form__input"
                        type="text"
                        value={form.fire_restriction}
                        onChange={(e) => set('fire_restriction', e.target.value)}
                        placeholder="e.g. No restrictions / Level 2 fire ban"
                    />
                </div>

                <div className="crud-form__field">
                    <label className="crud-form__label" htmlFor="park-firewood">⛺ Firewood Availability (%)</label>
                    <input
                        id="park-firewood"
                        className="crud-form__input"
                        type="number"
                        min="0"
                        max="100"
                        value={form.firewood_percent}
                        onChange={(e) => set('firewood_percent', Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                    />
                </div>

                <div className="crud-form__field">
                    <label className="crud-form__label" htmlFor="park-wildlife">🐻 Wildlife Notes</label>
                    <textarea
                        id="park-wildlife"
                        className="crud-form__textarea"
                        value={form.wildlife_notes}
                        onChange={(e) => set('wildlife_notes', e.target.value)}
                        rows={3}
                        placeholder="Any active wildlife advisories or sightings…"
                    />
                </div>

                <div className="crud-form__field">
                    <label className="crud-form__label" htmlFor="park-water">💧 Water Notes</label>
                    <textarea
                        id="park-water"
                        className="crud-form__textarea"
                        value={form.water_notes}
                        onChange={(e) => set('water_notes', e.target.value)}
                        rows={2}
                        placeholder="Water source conditions, filtration notes…"
                    />
                </div>

                <div className="crud-form__field">
                    <label className="crud-form__label" htmlFor="park-ranger">📞 Ranger Station</label>
                    <input
                        id="park-ranger"
                        className="crud-form__input"
                        type="text"
                        value={form.ranger_station}
                        onChange={(e) => set('ranger_station', e.target.value)}
                        placeholder="e.g. Brent Station · (705) 555-0100"
                    />
                </div>

                <div className="crud-form__field">
                    <label className="crud-form__label" htmlFor="park-notes">📝 Site Notes</label>
                    <textarea
                        id="park-notes"
                        className="crud-form__textarea"
                        value={form.custom_notes}
                        onChange={(e) => set('custom_notes', e.target.value)}
                        rows={3}
                        placeholder="Custom observations, portage tips, campsite quirks…"
                    />
                </div>

                {error && <p className="crud-form__error">{error}</p>}

                <div className="crud-form__actions">
                    <button type="button" className="crud-form__btn crud-form__btn--cancel" onClick={onClose}>
                        Cancel
                    </button>
                    <button type="submit" className="crud-form__btn crud-form__btn--save" disabled={saving}>
                        {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                </div>
            </form>
        </CrudSheet>
    );
}
