// @vitest-environment jsdom

import React, { useState } from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AppInfoDialog from './AppInfoDialog';
import ProjectIntelModal from './ProjectIntelModal';

function DialogHarness() {
  const [open, setOpen] = useState(false);

  return (
    <div data-trip-app-shell>
      <button type="button" onClick={() => setOpen(true)}>
        Open dialog
      </button>
      <AppInfoDialog
        isOpen={open}
        onClose={() => setOpen(false)}
        eyebrow="Trip orientation"
        title="Mission Brief"
        description="Current trip context"
      >
        <button type="button">Player control</button>
      </AppInfoDialog>
    </div>
  );
}

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
  vi.restoreAllMocks();
});

describe('AppInfoDialog', () => {
  it('portals outside the inert shell, locks scroll, and restores focus after close', async () => {
    render(<DialogHarness />);
    const opener = screen.getByRole('button', { name: 'Open dialog' });

    opener.focus();
    fireEvent.click(opener);

    const dialog = screen.getByRole('dialog', { name: 'Mission Brief' });
    const shell = document.querySelector<HTMLElement>('[data-trip-app-shell]');
    const inertShell = shell as HTMLElement & { inert: boolean };
    expect(shell?.contains(dialog)).toBe(false);
    expect(inertShell.inert).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Close Mission Brief' })
      )
    );

    fireEvent.click(screen.getByRole('button', { name: 'Player control' }));
    expect(screen.getByRole('dialog', { name: 'Mission Brief' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Close Mission Brief' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(inertShell.inert).toBe(false);
    expect(document.body.style.overflow).toBe('');
    expect(document.activeElement).toBe(opener);
  });

  it('closes by Escape and backdrop without leaving page locks behind', () => {
    render(<DialogHarness />);
    const opener = screen.getByRole('button', { name: 'Open dialog' });

    fireEvent.click(opener);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.body.style.overflow).toBe('');

    fireEvent.click(opener);
    fireEvent.click(screen.getByTestId('app-info-dialog-backdrop'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.body.style.overflow).toBe('');
  });

  it('renders About as semantic content without legacy markdown framing', () => {
    render(
      <div data-trip-app-shell>
        <ProjectIntelModal isOpen onClose={() => undefined} />
      </div>
    );

    expect(
      screen.getByRole('dialog', { name: 'Camping Dashboard' })
    ).toBeTruthy();
    expect(
      screen.getByRole('heading', { level: 3, name: 'Application foundation' })
    ).toBeTruthy();
    expect(screen.getAllByRole('list').length).toBeGreaterThan(0);
    expect(screen.queryByText(/##/)).toBeNull();
    expect(screen.queryByText(/PROJECT INTEL/)).toBeNull();
  });

  it('uses the shared semantic surface instead of the legacy fixed skin', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/app/globals.css'), 'utf8');
    const sharedDialogCss = css.slice(
      css.indexOf('.app-info-dialog {'),
      css.indexOf('/*\n * Trip navigation')
    );
    const missionSource = readFileSync(
      resolve(process.cwd(), 'src/components/ui/MissionBriefModal.tsx'),
      'utf8'
    );
    const aboutSource = readFileSync(
      resolve(process.cwd(), 'src/components/ui/ProjectIntelModal.tsx'),
      'utf8'
    );

    expect(sharedDialogCss).toContain('background: var(--surface-elevated)');
    expect(sharedDialogCss).toContain('border: 1px solid var(--border-strong)');
    expect(sharedDialogCss).toContain('box-shadow: var(--shadow-elevated)');
    expect(sharedDialogCss).toContain('color: var(--text-primary)');
    expect(sharedDialogCss).not.toContain('rgba(234, 179, 8');
    expect(missionSource).not.toContain('mission-brief-pip');
    expect(aboutSource).not.toContain('PROJECT_INTEL_TEXT');
  });
});
