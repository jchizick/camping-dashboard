// @vitest-environment jsdom

import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Alert, AlertRefreshState } from '@/types';
import AlertsCard from './AlertsCard';

afterEach(cleanup);

const state: AlertRefreshState = {
  trip_id: 'trip',
  provider: 'ontario-parks',
  provider_external_id: 'park/section',
  status: 'idle',
  last_attempt_at: '2026-07-27T02:00:00Z',
  last_success_at: '2026-07-27T02:00:00Z',
  next_refresh_at: '2026-07-27T08:00:00Z',
  locked_at: null,
  locked_by: null,
  attempt_count: 0,
  last_error_code: null,
  last_error_summary: null,
  last_fingerprint: 'a'.repeat(64),
  unsupported_reason: null,
  created_at: '2026-07-27T02:00:00Z',
  updated_at: '2026-07-27T02:00:00Z',
};
const alert: Alert = {
  id: 'alert',
  trip_id: 'trip',
  title: 'Route closure',
  body: 'Previously confirmed details.',
  severity: 'warning',
  source: 'Ontario Parks',
  is_active: true,
  created_at: '2026-07-27T02:00:00Z',
  provider: 'ontario-parks',
  external_id: 'closure',
  category: 'closure',
  status: 'active',
  source_url: 'https://www.ontarioparks.ca/park/example/alerts',
  issued_at: null,
  effective_at: null,
  expires_at: null,
  provider_updated_at: null,
  fingerprint: 'b'.repeat(64),
  dismissed_at: null,
  acknowledged_at: null,
  last_seen_at: '2026-07-27T02:00:00Z',
  resolved_at: null,
  updated_at: '2026-07-27T02:00:00Z',
};

describe('alert lifecycle rendering', () => {
  it('distinguishes unsupported from a confirmed fresh empty result', () => {
    const view = render(<AlertsCard alerts={[]} refreshStates={[]} />);
    expect(screen.getByText('No automated notice source is configured for this trip.')).toBeTruthy();
    view.rerender(<AlertsCard alerts={[]} refreshStates={[state]} />);
    expect(screen.getByText('No active notices were reported by the configured sources.')).toBeTruthy();
  });

  it('retains stale alerts and labels the failed refresh', () => {
    render(
      <AlertsCard
        alerts={[alert]}
        refreshStates={[{
          ...state,
          status: 'retry',
          last_error_code: 'provider_timeout',
        }]}
      />
    );
    expect(screen.getByText('Route closure')).toBeTruthy();
    expect(screen.getByText(/previously confirmed notices are retained/i)).toBeTruthy();
  });

  it('does not render a persistently dismissed provider alert', () => {
    render(
      <AlertsCard
        alerts={[{ ...alert, dismissed_at: '2026-07-27T03:00:00Z' }]}
        refreshStates={[state]}
        onDismissSystem={vi.fn()}
      />
    );
    expect(screen.queryByText('Route closure')).toBeNull();
  });
});
