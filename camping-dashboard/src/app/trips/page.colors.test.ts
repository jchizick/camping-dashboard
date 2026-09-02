import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(process.cwd(), 'src/app/globals.css'), 'utf8');

describe('Your Trips semantic color roles', () => {
  it('routes mobile identity and pending accents through canonical Field yellow', () => {
    expect(css).toContain(
      '--entry-brand-accent: var(--workspace-brand-accent, #efb54d)'
    );

    const mobileStart = css.indexOf('@media (max-width: 767px)', css.indexOf('Authenticated entry flow'));
    const mobileEnd = css.indexOf('@media (min-width: 640px)', mobileStart);
    const mobile = css.slice(mobileStart, mobileEnd);

    expect(mobileStart).toBeGreaterThan(0);
    expect(mobile).toMatch(
      /\.trips-welcome\[data-trips-state="populated"\] \.trips-primary-action > svg\s*\{[^}]*var\(--entry-brand-accent\)/
    );
    expect(mobile).toMatch(
      /\.trips-feature\s*\{[^}]*border-color:[^;}]*var\(--entry-brand-accent\)/
    );
    expect(mobile).toMatch(
      /\.trips-feature__status\s*\{[^}]*var\(--entry-brand-accent\)/
    );
    expect(mobile).toMatch(
      /\.trips-feature__status > svg\s*\{[^}]*var\(--entry-brand-accent\)/
    );
    expect(mobile).toMatch(
      /\.trips-feature__stat > svg\s*\{[^}]*color:\s*var\(--entry-brand-accent\)/
    );
    expect(mobile).toMatch(
      /\.trips-status--upcoming\s*\{[^}]*var\(--entry-brand-accent\)/
    );
  });

  it('keeps affirmative actions and secondary resource icons mint', () => {
    const actionStart = css.indexOf('.trips-primary-action {', css.indexOf('Authenticated entry flow'));
    const action = css.slice(actionStart, css.indexOf('}', actionStart));
    const resourceStart = css.indexOf('.trips-utility__icon {', actionStart);
    const resource = css.slice(resourceStart, css.indexOf('}', resourceStart));

    expect(action).toContain('background: var(--entry-sage)');
    expect(action).not.toContain('var(--entry-brand-accent)');
    expect(resource).toContain('color: var(--entry-sage)');
  });

  it('preserves the quieter entry amber for focused trip setup', () => {
    expect(css).toContain('--entry-amber: #e0ae55');
    expect(css).toMatch(
      /\.trip-create button:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--entry-amber\)/
    );
  });
});
