// @vitest-environment jsdom

import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CrudSheet from './CrudSheet';

afterEach(cleanup);

describe('CrudSheet accessibility', () => {
  it('labels the dialog, traps focus, closes with Escape, and restores focus', () => {
    const onClose = vi.fn();
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Open editor</button>
          <CrudSheet
            isOpen={open}
            onClose={() => {
              onClose();
              setOpen(false);
            }}
            title="Edit event"
          >
            <label>
              Event title
              <input />
            </label>
            <button type="button">Save event</button>
          </CrudSheet>
        </>
      );
    }
    render(<Harness />);

    const opener = screen.getByRole('button', { name: 'Open editor' });
    opener.focus();
    fireEvent.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Edit event' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');

    const close = screen.getByRole('button', { name: 'Close panel' });
    const save = screen.getByRole('button', { name: 'Save event' });
    save.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(close);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(opener);
  });

  it('applies the dense workspace treatment only when requested', () => {
    const view = render(
      <CrudSheet isOpen onClose={() => {}} title="Default editor">
        Default
      </CrudSheet>
    );
    expect(document.querySelector('.crud-sheet__panel--workspace')).toBeNull();

    view.rerender(
      <CrudSheet isOpen onClose={() => {}} title="Trip editor" surface="workspace">
        Trip
      </CrudSheet>
    );
    expect(document.querySelector('.crud-sheet__panel--workspace')).toBeTruthy();
    expect(screen.getByRole('dialog', { name: 'Trip editor' })).toBeTruthy();
  });
});
