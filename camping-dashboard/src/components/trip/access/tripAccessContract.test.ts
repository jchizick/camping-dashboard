import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
const read = (path: string) => readFileSync(resolve('src', path), 'utf8');
describe('Trip Access composition boundary', () => {
  it('uses existing Owner and online state without changing authorization or Crew', () => {
    const shell = read('components/trip/TripAppShell.tsx');
    expect(shell).toContain("eligible={isOwner && source === 'online' && connectivity === 'online'}");
    const hook = read('components/trip/access/useTripAccessManagement.ts');
    expect(hook).not.toMatch(/supabase|serviceRole|crew|participant|responsibilit/i);
    expect(hook).toContain("fetch('/api/invitations'");
  });
  it('keeps the entry in phone More, not a new bottom destination', () => {
    expect(read('components/trip/TripMoreMenu.tsx')).toContain('Trip access');
    expect(read('components/trip/TripMobileNav.tsx')).not.toContain('Trip access');
  });
  it('uses semantic phone layout and narrowly scoped wrapping and focus styles', () => {
    expect(read('components/trip/access/TripAccessSheet.tsx')).toContain('usePhoneLayout()');
    const css = read('components/trip/access/tripAccess.css');
    expect(css).toContain('overflow-wrap: anywhere'); expect(css).toContain(':focus-visible');
    expect(css).toContain('.trip-access-sheet--phone');
  });
});
