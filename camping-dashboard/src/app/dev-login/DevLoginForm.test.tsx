// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DevLoginForm from './DevLoginForm';

const { replace, refresh, signInWithPassword } = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  signInWithPassword: vi.fn(),
}));
let nextDestination = '/trips/trip-1';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh }),
  useSearchParams: () => new URLSearchParams({ next: nextDestination }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword,
    },
  },
}));

beforeEach(() => {
  nextDestination = '/trips/trip-1';
  signInWithPassword.mockResolvedValue({ error: null });
});

afterEach(cleanup);

describe('DevLoginForm', () => {
  it('uses normal Supabase password authentication and redirects internally', async () => {
    render(<DevLoginForm />);

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'qa-owner@example.test' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'test-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(signInWithPassword).toHaveBeenCalledWith({
        email: 'qa-owner@example.test',
        password: 'test-password',
      });
    });
    expect(replace).toHaveBeenCalledWith('/trips/trip-1');
    expect(refresh).toHaveBeenCalled();
  });

  it('rejects an external next destination and falls back to the trip list', async () => {
    nextDestination = 'https://malicious.example/steal-session';
    render(<DevLoginForm />);

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'qa-viewer@example.test' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'test-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/trips'));
  });

  it('shows a safe error and does not redirect when authentication fails', async () => {
    signInWithPassword.mockResolvedValue({ error: new Error('credential details') });
    render(<DevLoginForm />);

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'qa-editor@example.test' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'wrong-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(
      await screen.findByText('Sign-in failed. Check the QA account credentials and try again.')
    ).toBeTruthy();
    expect(screen.queryByText('credential details')).toBeNull();
    expect(replace).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });
});
