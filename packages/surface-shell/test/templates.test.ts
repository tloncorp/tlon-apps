import { describe, expect, test } from 'vitest';

import { runShellFixture } from '../src/node/index';
import { loadTemplate, templateNames } from './fixtures';

/**
 * The CI template-render job the fixture runner was built for: every
 * shipped authoring template, rendered through the REAL shell against a
 * stubbed bridge host.
 *
 * A template is the thing an authoring bot copies, so a shell change that
 * breaks one breaks every app generated from it. The point of running them
 * here rather than only in `tlon-skill` is location: this turns red in the
 * package where the breaking change was written, before it reaches a
 * generated app that nobody is looking at.
 *
 * Templates land as more directories, not more runner code — the loop below
 * takes whatever `templateNames()` finds.
 */

const names = templateNames();

test('the template catalogue is not empty', () => {
  // A loop over an empty list is a green suite that checks nothing, which
  // is exactly how a moved or renamed templates directory would go
  // unnoticed here.
  expect(names.length).toBeGreaterThan(0);
});

describe.each(names)('template %s', (name) => {
  const declaredActions = () => {
    const template = loadTemplate(name);
    return Object.keys(
      (template.spec as unknown as { actions?: Record<string, unknown> })
        .actions ?? {}
    );
  };

  /**
   * Whether this template declares itself display-only.
   *
   * A countdown has no member actions, therefore no buttons and no
   * per-member state, and the assertions below about controls and crew are
   * false of it by design rather than broken. The waiver is granted ONLY by
   * the declaration: an app that merely happens to have no actions still has
   * to show buttons and people, because "no actions" is also exactly what a
   * forgotten action looks like — which is the failure the marker exists to
   * tell apart, and it has shipped three times.
   */
  const displayOnly = () => {
    const marker = (
      loadTemplate(name).spec as unknown as {
        memberInteraction?: { mode?: string };
      }
    ).memberInteraction;
    return marker?.mode === 'none';
  };

  function run(options: { canInvoke?: boolean; populated?: boolean } = {}) {
    const template = loadTemplate(name);
    return runShellFixture({
      window,
      bundleSource: template.bundleSource,
      spec: template.spec,
      state:
        options.populated === false ? template.initialState : template.state,
      canInvoke: options.canInvoke,
    });
  }

  test('renders its first-member screen without reporting an error', () => {
    const shell = run({ populated: false });
    expect(shell.messages[0]).toMatchObject({ type: 'ready' });
    expect(shell.errors()).toHaveLength(0);
    // The broken-state view is what a throwing render produces; it is never
    // what a template should produce.
    expect(shell.root.querySelector('.tsh-broken')).toBeNull();
    expect((shell.root.textContent ?? '').trim().length).toBeGreaterThan(0);
    const buttons = shell.root.querySelectorAll('button');
    if (displayOnly()) {
      // Not merely "no assertion": a declared display-only app must have NO
      // controls, which is a stronger claim than the one made of every other
      // template and is the claim its declaration actually makes.
      expect(buttons.length).toBe(0);
    } else {
      expect(buttons.length).toBeGreaterThan(0);
    }
  });

  test('renders a populated crew, with a sigil for every member', () => {
    // The empty screen exercises almost none of a template: crew lists,
    // avatars and charts are all behind a non-empty state, so a shell change
    // that broke the avatar would render a green empty screen forever.
    const template = loadTemplate(name);
    const shell = run();
    expect(shell.errors()).toHaveLength(0);
    expect(shell.root.querySelector('.tsh-broken')).toBeNull();
    if (displayOnly()) {
      // Its populated state is host-written and may name nobody. Requiring a
      // crew here would push a countdown to invent people to satisfy a test,
      // which is the same pressure the marker exists to relieve.
      return;
    }

    const ships = new Set<string>();
    const collect = (value: unknown) => {
      if (typeof value === 'string' && /^~[a-z-]+$/.test(value)) {
        return;
      }
      if (Array.isArray(value)) {
        value.forEach(collect);
        return;
      }
      if (value && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) {
          if (/^~[a-z][a-z-]*$/.test(key)) {
            ships.add(key);
          }
          collect(child);
        }
      }
    };
    collect(template.state);
    expect(ships.size).toBeGreaterThan(0);

    const text = shell.root.textContent ?? '';
    for (const ship of ships) {
      expect(text).toContain(ship);
    }
    const avatars = shell.root.querySelectorAll('.tsh-avatar');
    expect(avatars.length).toBeGreaterThan(0);
    // A sigil, not the initials fallback: every one of these ships is a
    // name the library can draw, so an avatar without an <svg> means the
    // sigil path broke.
    for (const avatar of Array.from(avatars)) {
      expect(avatar.querySelector('svg')).toBeTruthy();
    }
  });

  test('every control invokes an action the spec declares', () => {
    const shell = run();
    const declared = new Set(declaredActions());
    const buttons = Array.from(shell.root.querySelectorAll('button'));
    if (displayOnly()) {
      // The whole claim, and it is checkable: nothing to press, so nothing
      // can be invoked. A display-only app that fired an invoke would be
      // lying about itself.
      expect(buttons.length).toBe(0);
      expect(declared.size).toBe(0);
      expect(shell.invokes()).toHaveLength(0);
      return;
    }

    for (const button of buttons) {
      button.click();
    }

    const fired = shell.invokes();
    expect(fired.length).toBeGreaterThan(0);
    for (const invoke of fired) {
      expect(declared).toContain(invoke.actionId);
    }
    expect(shell.errors()).toHaveLength(0);
  });

  test('a read-only viewer sees the same screen with the controls off', () => {
    const shell = run({ canInvoke: false });
    const buttons = Array.from(shell.root.querySelectorAll('button'));
    if (displayOnly()) {
      // Every viewer of a display-only app is already read-only, so the
      // screen must not change at all between the two.
      expect(buttons.length).toBe(0);
      expect(shell.root.textContent).toBe(run().root.textContent);
      expect(shell.errors()).toHaveLength(0);
      return;
    }
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.every((button) => button.disabled)).toBe(true);

    for (const button of buttons) {
      button.click();
    }
    expect(shell.invokes()).toHaveLength(0);
    expect(shell.errors()).toHaveLength(0);
  });
});
