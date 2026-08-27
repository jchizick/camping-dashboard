// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { evaluateOfflineCategory } from '@/lib/readiness';
import type { FieldViewModel } from './fieldViewModel';
import MobileFieldOverview from './MobileFieldOverview';

vi.mock('@/components/cards/AlertFormSheet', () => ({
  default: ({ isOpen }: { isOpen: boolean }) => isOpen ? <div data-testid="notice-sheet" /> : null,
}));

vi.mock('@/components/cards/ParkIntelFormSheet', () => ({
  default: ({ isOpen }: { isOpen: boolean }) => isOpen ? <div data-testid="intel-sheet" /> : null,
}));

afterEach(cleanup);

function model(): FieldViewModel {
  const offlineStatus = {
    trip_id: 'trip-1',
    maps_cached: true,
    permit_saved: false,
    daily_vehicle_permit_saved: false,
    route_downloaded: true,
    satellite_device_connected: true,
    satellite_device_name: 'inReach Mini 2',
    emergency_contact_ready: false,
    updated_at: '2026-08-23T12:00:00Z',
  };
  const notice = {
    id: 'notice-1',
    trip_id: 'trip-1',
    title: 'Long route notice',
    body: 'Full operational detail that should remain available only through the notice disclosure. Follow the west bypass and check in with the ranger station.',
    severity: 'warning' as const,
    source: 'Ontario Parks',
    is_active: true,
    created_at: '2026-08-23T12:00:00Z',
    provider: 'ontario-parks',
    external_id: 'route-1',
    category: 'closure',
    status: 'active',
    source_url: 'https://example.com/notices/route-1',
    issued_at: null,
    effective_at: null,
    expires_at: null,
    provider_updated_at: null,
    fingerprint: 'a'.repeat(64),
    dismissed_at: null,
    acknowledged_at: null,
    last_seen_at: '2026-08-23T12:00:00Z',
    resolved_at: null,
    updated_at: '2026-08-23T12:00:00Z',
  };

  return {
    trip: {
      id: 'trip-1',
      name: 'North Lake',
      park_name: 'Algonquin Park',
      lake_name: 'North Tea Lake',
      site_name: 'Site 12',
      start_date: '2026-08-01',
      end_date: '2026-08-03',
    },
    alerts: [notice],
    notices: [{
      alert: notice,
      displayTitle: 'Long route notice',
      summary: 'Follow the marked west bypass until repairs are complete.',
      sourceLabel: 'Ontario Parks',
      updatedLabel: 'Aug 23, 8:00 a.m.',
      isManual: false,
    }],
    noticeRefresh: {
      processing: false,
      failed: false,
      unsupported: false,
      hasSuccessfulRefresh: true,
      emptyMessage: 'No active notices were reported by the configured sources.',
    },
    alertRefreshStates: [],
    parkIntel: {
      trip_id: 'trip-1',
      fire_restriction: 'Partial fire ban after 7 PM',
      wildlife_notes: 'Store food in the bear cache.',
      ranger_station: 'West Gate · 705-555-0142',
      firewood_percent: 60,
      water_notes: 'Boil or filter lake water.',
      custom_notes: 'Landing is rocky in low water.',
      updated_at: '2026-08-23T12:00:00Z',
    },
    offlineStatus,
    manualPrep: evaluateOfflineCategory(offlineStatus, true, 'trip-1'),
    currentWeather: null,
    astro: null,
    showOffline: true,
    showAstro: true,
    essentials: {
      fire: 'Partial fire ban after 7 PM',
      water: 'Boil or filter lake water.',
      ranger: 'West Gate · 705-555-0142',
      rangerHref: 'tel:7055550142',
      site: {
        label: 'North Tea — 12',
        location: 'North Tea Lake · Algonquin Park',
        notes: 'Landing is rocky in low water.',
      },
      conditions: {
        temperature: '18°C',
        condition: 'Light rain',
        rainChance: '70% rain',
        wind: '16 km/h wind',
        sunset: 'Sunset 8:11 PM',
      },
    },
    reference: {
      wildlife: 'Store food in the bear cache.',
      firewoodPercent: 60,
      astro: null,
    },
  } as unknown as FieldViewModel;
}

describe('mobile Field composition', () => {
  it('renders the readiness-first hierarchy with compact, expandable notices', () => {
    const actions = new Proxy({}, { get: () => vi.fn().mockResolvedValue(undefined) });
    const view = render(<MobileFieldOverview model={model()} actions={actions as never} />);

    expect(screen.getByRole('heading', { name: 'Field Essentials' })).toBeTruthy();
    expect(screen.getByText('Partial fire ban after 7 PM')).toBeTruthy();
    expect(screen.getByRole('link', { name: /call ranger or park contact/i }).getAttribute('href')).toBe('tel:7055550142');
    expect(screen.getByRole('heading', { name: 'Notices · 1' })).toBeTruthy();

    const disclosure = view.container.querySelector('details.mobile-field-notice') as HTMLDetailsElement;
    expect(disclosure.open).toBe(false);
    fireEvent.click(disclosure.querySelector('summary') as HTMLElement);
    expect(disclosure.open).toBe(true);
    expect(screen.getByText(/Full operational detail/)).toBeTruthy();
    expect(screen.getByRole('link', { name: /open notice source/i }).getAttribute('href')).toBe('https://example.com/notices/route-1');

    expect(screen.getByRole('heading', { name: 'Field Prep' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /ready|not ready/i })).toHaveLength(6);
    expect(screen.getByText('Satellite device:')).toBeTruthy();
    expect(screen.getByText('Park Reference')).toBeTruthy();
    expect(screen.queryByText('Offline Vault')).toBeNull();
    expect(screen.queryByText('Safety Readiness')).toBeNull();
    expect(screen.queryByText('Access Project Intel')).toBeNull();
  });

  it('removes editing controls for viewers while keeping all field information readable', () => {
    render(<MobileFieldOverview model={model()} actions={null} />);

    expect(screen.queryByRole('button', { name: 'Edit Field essentials' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add manual notice' })).toBeNull();
    expect(screen.getAllByRole('button', { name: /ready|not ready/i }).every((button) => button.hasAttribute('disabled'))).toBe(true);
    expect(screen.getByText('Boil or filter lake water.')).toBeTruthy();
  });

  it('passes manual confirmations through the existing Field Prep mutation', () => {
    const toggleOfflineStatus = vi.fn().mockResolvedValue(undefined);
    render(
      <MobileFieldOverview
        model={model()}
        actions={{ toggleOfflineStatus } as never}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Permit Saved: not ready' }));
    expect(toggleOfflineStatus).toHaveBeenCalledWith('permit_saved');
  });

  it('uses calm, truthful empty states when optional field sources are absent', () => {
    const empty = model();
    empty.notices = [];
    empty.essentials = {
      fire: null,
      water: null,
      ranger: null,
      rangerHref: null,
      site: null,
      conditions: null,
    };
    empty.reference = { wildlife: null, firewoodPercent: null, astro: null };

    render(<MobileFieldOverview model={empty} actions={null} />);

    expect(screen.getByText('Field essentials have not been added yet.')).toBeTruthy();
    expect(screen.getByText('No active notices')).toBeTruthy();
    expect(screen.queryByText('Park Reference')).toBeNull();
  });

  it('turns unavailable Field Prep into one read-only setup state without six failures', () => {
    const unavailable = model();
    unavailable.offlineStatus = null;
    unavailable.manualPrep = evaluateOfflineCategory(null, true, 'trip-1');

    render(<MobileFieldOverview model={unavailable} actions={null} />);

    expect(screen.getByText('Unavailable')).toBeTruthy();
    expect(screen.getByText('Field Prep hasn’t been set up yet')).toBeTruthy();
    expect(screen.getByText(/saved trip is read-only/i)).toBeTruthy();
    expect(screen.queryByText('0% complete')).toBeNull();
    expect(screen.queryAllByRole('button', { name: /ready|not ready/i })).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Set up Field Prep' })).toBeNull();
  });

  it('initializes Field Prep through the existing editable workspace action', async () => {
    const unavailable = model();
    unavailable.offlineStatus = null;
    unavailable.manualPrep = evaluateOfflineCategory(null, true, 'trip-1');
    const initializeFieldPrep = vi.fn().mockResolvedValue(undefined);

    render(
      <MobileFieldOverview
        model={unavailable}
        actions={{ initializeFieldPrep } as never}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Set up Field Prep' }));
    expect(initializeFieldPrep).toHaveBeenCalledTimes(1);
  });
});
