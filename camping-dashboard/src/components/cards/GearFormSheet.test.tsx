// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CrewMember, GearItem } from '@/types';
import GearFormSheet from './GearFormSheet';

const item = (overrides: Partial<GearItem> = {}): GearItem => ({
    id: 'gear-1',
    trip_id: 'trip-1',
    name: 'Tent',
    category: 'Shelter',
    priority: 'critical',
    owner: '',
    responsible_crew_member_id: null,
    weight_kg: 2.4,
    notes: '',
    acquired: false,
    packed: false,
    ...overrides,
});

const crew = [{
    id: 'crew-jordan', trip_id: 'trip-1', trip_member_id: null, name: 'Jordan',
    role: 'Lead', load_item: '', load_weight_kg: 0, canoe_number: 1, notes: '',
}] satisfies CrewMember[];

describe('GearFormSheet Required control', () => {
    afterEach(cleanup);

    it('maps the user-facing Required control to the existing critical value', async () => {
        const onSubmit = vi.fn().mockResolvedValue(undefined);
        render(
            <GearFormSheet
                isOpen
                onClose={() => {}}
                onSubmit={onSubmit}
            />
        );

        fireEvent.change(screen.getByLabelText('Item Name *'), { target: { value: 'Water filter' } });
        const required = screen.getByRole('checkbox', { name: /Required for this trip/ });
        fireEvent.click(required);

        expect(required.getAttribute('checked')).toBeNull();
        expect((required as HTMLInputElement).checked).toBe(true);
        expect(screen.getByLabelText('Packing priority').hasAttribute('disabled')).toBe(true);
        expect(screen.queryByText('Critical')).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Add Item' }));
        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
        expect(onSubmit.mock.calls[0][0].priority).toBe('critical');
    });

    it('presets Required for explicit intent without changing the generic default', () => {
        const view = render(
            <GearFormSheet
                isOpen
                onClose={() => {}}
                onSubmit={vi.fn().mockResolvedValue(undefined)}
                defaultRequired
            />
        );
        expect((screen.getByRole('checkbox', { name: /Required for this trip/ }) as HTMLInputElement).checked).toBe(true);

        view.rerender(
            <GearFormSheet
                isOpen
                onClose={() => {}}
                onSubmit={vi.fn().mockResolvedValue(undefined)}
                defaultRequired={false}
            />
        );
        expect((screen.getByRole('checkbox', { name: /Required for this trip/ }) as HTMLInputElement).checked).toBe(false);
    });

    it('allows an existing Required item to become non-required without a schema change', async () => {
        const onSubmit = vi.fn().mockResolvedValue(undefined);
        render(
            <GearFormSheet
                isOpen
                onClose={() => {}}
                onSubmit={onSubmit}
                initialItem={item()}
            />
        );

        const required = screen.getByRole('checkbox', { name: /Required for this trip/ });
        expect((required as HTMLInputElement).checked).toBe(true);
        fireEvent.click(required);
        expect(screen.getByLabelText('Packing priority').hasAttribute('disabled')).toBe(false);

        fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
        expect(onSubmit.mock.calls[0][0].priority).toBe('high');
    });

    it('writes the Crew ID and clears legacy owner text when responsibility is chosen', async () => {
        const onSubmit = vi.fn().mockResolvedValue(undefined);
        render(
            <GearFormSheet
                isOpen onClose={() => {}} onSubmit={onSubmit} crew={crew}
                initialItem={item({ owner: 'Old Jordan' })}
            />
        );

        expect(screen.getByText(/Legacy assignment: Old Jordan/)).toBeTruthy();
        fireEvent.change(screen.getByLabelText('Responsible'), { target: { value: 'crew-jordan' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
        expect(onSubmit.mock.calls[0][0]).toMatchObject({
            responsible_crew_member_id: 'crew-jordan', owner: null,
        });
    });

    it('does not re-write legacy owner text beside an authoritative Crew ID', async () => {
        const onSubmit = vi.fn().mockResolvedValue(undefined);
        render(<GearFormSheet isOpen onClose={() => {}} onSubmit={onSubmit} crew={crew} initialItem={item({ owner: 'Jordan legacy', responsible_crew_member_id: 'crew-jordan' })} />);
        fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
        await waitFor(() => expect(onSubmit.mock.calls[0][0].owner).toBeNull());
    });
});
