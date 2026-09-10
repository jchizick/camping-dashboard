// @vitest-environment jsdom
import React, { useEffect } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  user: { id: 'a', email: 'camper@example.com', user_metadata: { full_name: 'Camper' } } as { id: string; email?: string; user_metadata?: { full_name?: string } } | null,
  identity: null as { userId: string; source: string } | null, push: vi.fn(), signOut: vi.fn(),
}));
vi.mock('@/lib/authContext', () => ({ useAuth: () => mocks }));
vi.mock('next/navigation', () => ({ usePathname: () => '/trips/a/gear', useRouter: () => ({ push: mocks.push }) }));
import WorkspaceAccount from './WorkspaceAccount';
import WorkspaceBrand from './WorkspaceBrand';
import TripMoreMenu from './TripMoreMenu';
import { TripDraftGuardProvider, useTripDraftGuard } from './TripDraftGuardProvider';
beforeEach(() => { mocks.user = { id: 'a', email: 'camper@example.com', user_metadata: { full_name: 'Camper' } }; mocks.identity = null; mocks.push.mockReset(); mocks.signOut.mockReset(); });
afterEach(cleanup);
function ProtectedActions() {
  const guard = useTripDraftGuard();
  const { registerDraft, setDraftDirty } = guard;
  useEffect(() => { const unregister = registerDraft('test'); setDraftDirty('test', true); return unregister; }, [registerDraft, setDraftDirty]);
  return <><WorkspaceBrand tripId="a" /><WorkspaceAccount onAbout={vi.fn()} onSignOut={async () => { await guard.requestAction(mocks.signOut); }} />
    <TripMoreMenu id="test" tripId="a" onProjectIntel={vi.fn()} onSignOut={mocks.signOut} /></>;
}
describe('workspace account', () => {
  it('shows auth identity with no profile request, then resets on account change', () => {
    const view = render(<WorkspaceAccount onAbout={vi.fn()} onSignOut={mocks.signOut} />);
    fireEvent.click(screen.getByRole('button', { name: 'Account: Camper' }));
    expect(screen.getByText('camper@example.com')).toBeTruthy();
    mocks.user = { id: 'b', email: 'second@example.com' };
    view.rerender(<WorkspaceAccount onAbout={vi.fn()} onSignOut={mocks.signOut} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText('camper@example.com')).toBeNull();
    expect(screen.getByRole('button', { name: 'Account: second@example.com' })).toBeTruthy();
  });
  it('uses a truthful saved-account fallback and retains About and sign out', () => {
    mocks.user = null; mocks.identity = { userId: 'a', source: 'local' };
    const about = vi.fn(); render(<WorkspaceAccount onAbout={about} onSignOut={mocks.signOut} />);
    fireEvent.click(screen.getByRole('button', { name: 'Account: Saved account' }));
    expect(screen.getByText('Profile unavailable offline')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'About Field Protocol' }));
    expect(about).toHaveBeenCalledOnce(); expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('wraps Tab focus, dismisses Escape and restores the badge', async () => {
    render(<WorkspaceAccount onAbout={vi.fn()} onSignOut={mocks.signOut} />);
    const trigger = screen.getByRole('button', { name: 'Account: Camper' }); trigger.focus(); fireEvent.click(trigger);
    const close = screen.getByRole('button', { name: 'Close Account' });
    await waitFor(() => expect(document.activeElement).toBe(close));
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Sign out' }));
    fireEvent.keyDown(document.activeElement!, { key: 'Tab' }); expect(document.activeElement).toBe(close);
    fireEvent.keyDown(document, { key: 'Escape' }); expect(document.activeElement).toBe(trigger);
  });
  it('guards brand, Field Log and sign out without discarding cancelled drafts', async () => {
    render(<TripDraftGuardProvider><ProtectedActions /></TripDraftGuardProvider>);
    fireEvent.click(screen.getByRole('link', { name: 'Field Protocol — current trip Overview' }));
    expect(screen.getByRole('alertdialog')).toBeTruthy(); expect(mocks.push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Stay and continue editing' }));
    fireEvent.click(screen.getByRole('button', { name: 'Trip Extras' }));
    fireEvent.click(screen.getByRole('link', { name: 'Field Log' }));
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Stay and continue editing' }));
    fireEvent.click(screen.getByRole('button', { name: 'Account: Camper' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(mocks.signOut).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes and continue' }));
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledOnce());
  });
});
