import { describe, expect, it } from 'vitest';
import manifest from './manifest';

describe('Field Protocol manifest', () => {
  it('defines a minimal scoped standalone application without install marketing', () => {
    expect(manifest()).toMatchObject({
      name: 'Field Protocol',
      short_name: 'Field Protocol',
      start_url: '/trips',
      scope: '/',
      display: 'standalone',
      icons: [{ src: '/logo.svg', sizes: 'any', type: 'image/svg+xml' }],
    });
  });
});
