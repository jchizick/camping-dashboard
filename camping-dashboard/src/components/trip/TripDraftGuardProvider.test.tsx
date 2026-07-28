// @vitest-environment jsdom

import React, { useState } from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GuardedTripLink from './GuardedTripLink';
import {
  TripDraftGuardProvider,
  useTripDraftGuard,
} from './TripDraftGuardProvider';
import { useTripDraftForm } from './useTripDraftForm';

const navigation = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useRouter: () => ({ push: navigation.push, replace: navigation.replace }),
}));

function DraftForm({
  id = 'draft-one',
  label = 'Trip title',
}: {
  id?: string;
  label?: string;
}) {
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(true);
  const { close, saved } = useTripDraftForm({
    id,
    isOpen: open,
    isDirty: value !== '',
    onClose: () => setOpen(false),
    onDiscard: () => setValue(''),
  });

  if (!open) return <span>Form closed</span>;

  return (
    <div>
      <label>
        {label}
        <input value={value} onChange={(event) => setValue(event.target.value)} />
      </label>
      <button
        type="button"
        onClick={() => {
          saved();
          setValue('');
        }}
      >
        Save
      </button>
      <button
        type="button"
        onClick={() => {
          setValue('');
          saved();
        }}
      >
        Reset
      </button>
      <button type="button" onClick={close}>
        Close
      </button>
    </div>
  );
}

function GuardState() {
  const { hasDirtyDrafts } = useTripDraftGuard();
  return <output>{hasDirtyDrafts ? 'dirty' : 'clean'}</output>;
}

function TestSurface({ multiple = false }: { multiple?: boolean }) {
  return (
    <TripDraftGuardProvider>
      <button type="button">Navigation origin</button>
      <DraftForm />
      {multiple ? <DraftForm id="draft-two" label="Campsite label" /> : null}
      <GuardState />
      <GuardedTripLink href="/trips/trip-1/gear">Gear</GuardedTripLink>
    </TripDraftGuardProvider>
  );
}

beforeEach(() => {
  navigation.push.mockReset();
  navigation.replace.mockReset();
});

afterEach(cleanup);

describe('TripDraftGuardProvider', () => {
  it('allows clean navigation without opening a confirmation', () => {
    render(<TestSurface />);
    fireEvent.click(screen.getByRole('link', { name: 'Gear' }));

    expect(navigation.push).toHaveBeenCalledWith('/trips/trip-1/gear');
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('blocks dirty navigation, lets Stay preserve the form, then discards and continues', async () => {
    render(<TestSurface />);
    const input = screen.getByRole('textbox', { name: 'Trip title' });
    fireEvent.change(input, { target: { value: 'Changed title' } });
    fireEvent.click(screen.getByRole('link', { name: 'Gear' }));

    expect(navigation.push).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Stay and continue editing' })
      )
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Stay and continue editing' })
    );
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect((input as HTMLInputElement).value).toBe('Changed title');
    expect(navigation.push).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('link', { name: 'Gear' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Discard changes and continue' })
    );

    await waitFor(() =>
      expect(navigation.push).toHaveBeenCalledWith('/trips/trip-1/gear')
    );
  });

  it('clears dirty state after save, reset, and a confirmed dirty sheet close', async () => {
    render(<TestSurface />);
    const input = screen.getByRole('textbox', { name: 'Trip title' });

    fireEvent.change(input, { target: { value: 'Draft' } });
    expect(screen.getByText('dirty')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByText('clean')).toBeTruthy());

    fireEvent.change(input, { target: { value: 'Another draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(screen.getByText('clean')).toBeTruthy());

    fireEvent.change(input, { target: { value: 'Close me' } });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', { name: 'Discard changes and continue' })
    );
    await waitFor(() => expect(screen.getByText('Form closed')).toBeTruthy());
  });

  it('discards every registered dirty form before continuing', async () => {
    render(<TestSurface multiple />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Trip title' }), {
      target: { value: 'One' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Campsite label' }), {
      target: { value: 'Two' },
    });
    fireEvent.click(screen.getByRole('link', { name: 'Gear' }));

    expect(
      screen.getByText((content) =>
        content.includes('2 open forms have unsaved changes.')
      )
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', { name: 'Discard changes and continue' })
    );
    await waitFor(() => expect(screen.getByText('clean')).toBeTruthy());
    expect(navigation.push).toHaveBeenCalledTimes(1);
  });

  it('registers beforeunload only while dirty and removes it on cleanup', async () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const view = render(<TestSurface />);

    expect(
      addSpy.mock.calls.some(([eventName]) => eventName === 'beforeunload')
    ).toBe(false);

    fireEvent.change(screen.getByRole('textbox', { name: 'Trip title' }), {
      target: { value: 'Draft' },
    });
    await waitFor(() =>
      expect(
        addSpy.mock.calls.some(([eventName]) => eventName === 'beforeunload')
      ).toBe(true)
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    await waitFor(() =>
      expect(
        removeSpy.mock.calls.some(([eventName]) => eventName === 'beforeunload')
      ).toBe(true)
    );

    view.unmount();
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('intercepts browser history changes while dirty and preserves the target URL', async () => {
    render(<TestSurface />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Trip title' }), {
      target: { value: 'Draft' },
    });

    window.history.pushState({}, '', '/trips/trip-1/plan?day=2');
    fireEvent(window, new PopStateEvent('popstate'));

    expect(navigation.replace).toHaveBeenCalledWith('/');
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', { name: 'Discard changes and continue' })
    );
    await waitFor(() =>
      expect(navigation.push).toHaveBeenCalledWith(
        '/trips/trip-1/plan?day=2'
      )
    );
    window.history.replaceState({}, '', '/');
  });
});
