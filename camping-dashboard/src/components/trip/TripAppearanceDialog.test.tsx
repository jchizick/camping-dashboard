// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TripAppearanceDialog from './TripAppearanceDialog';

afterEach(cleanup);

describe('TripAppearanceDialog', () => {
  it('exposes the default and secondary choices as an accessible radio group', () => {
    render(
      <TripAppearanceDialog
        isOpen
        currentTheme="expedition"
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog', { name: 'Appearance' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Expedition.*Default/ })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Clean.*Secondary/ })).toBeTruthy();
    expect(
      (screen.getByRole('radio', { name: /Expedition.*Default/ }) as HTMLInputElement)
        .checked
    ).toBe(true);
  });

  it('saves a new selection and closes after success', async () => {
    const onSelect = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(
      <TripAppearanceDialog
        isOpen
        currentTheme="expedition"
        onSelect={onSelect}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByRole('radio', { name: /Clean.*Secondary/ }));
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith('clean'));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('keeps the dialog open and announces persistence failures', async () => {
    const onClose = vi.fn();
    render(
      <TripAppearanceDialog
        isOpen
        currentTheme="expedition"
        onSelect={vi.fn().mockRejectedValue(new Error('Theme save failed'))}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByRole('radio', { name: /Clean.*Secondary/ }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Theme save failed'
    );
    expect(onClose).not.toHaveBeenCalled();
  });
});
