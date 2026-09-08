import { STATIC_MANIFESTS } from '@tloncorp/shared/domain';
import * as icons from '@tloncorp/ui/assets/icons';
import { describe, expect, it } from 'vitest';

import { makeIconResolver, toIconType } from './slashCommandIcon';

// A CJS-interop namespace, which is what the native Babel build produces: an
// ordinary object (so Object.prototype is in its chain) carrying `__esModule`.
// The test runner's own namespace is true ESM — null prototype, no
// `__esModule` — so the hostile keys are simply absent there and a vulnerable
// `in` check would look safe. Injecting the shape is the only way to bind the
// real behavior.
function cjsIconNamespace() {
  const ns: Record<string, unknown> = {
    __esModule: true,
    default: {},
    Command: () => null,
    Bang: () => null,
  };
  return ns;
}

describe('makeIconResolver', () => {
  const resolve = makeIconResolver(cjsIconNamespace());

  it('accepts a real icon export', () => {
    expect(resolve('Command')).toBe('Command');
    expect(resolve('Bang')).toBe('Bang');
  });

  // Each of these passes `name in ns` on a CJS namespace and would then be
  // rendered as a component: `__esModule` is a boolean, the rest are inherited
  // functions/accessors. Any one of them crashes the composer for every `/`
  // press in that conversation.
  it.each([
    '__esModule',
    'default',
    'constructor',
    'toString',
    'valueOf',
    'hasOwnProperty',
    '__proto__',
  ])('falls back to Command for hostile key %s', (hostile) => {
    expect(resolve(hostile)).toBe('Command');
  });

  it('falls back for unknown, empty, and absent names', () => {
    expect(resolve('NotARealIcon')).toBe('Command');
    expect(resolve('')).toBe('Command');
    expect(resolve(undefined)).toBe('Command');
  });

  it('only ever returns a key the namespace really owns', () => {
    const ns = cjsIconNamespace();
    const real = Object.keys(ns).filter(
      (key) => key !== '__esModule' && key !== 'default'
    );
    const hostileResolve = makeIconResolver(ns);

    for (const name of ['Command', '__esModule', 'constructor', 'nope']) {
      expect(real).toContain(hostileResolve(name));
    }
  });
});

// The exported resolver is the one the popup uses; confirm it is bound to the
// real icon module and still refuses the hostile names.
describe('toIconType', () => {
  it('resolves a real icon and rejects metadata keys', () => {
    expect(Object.keys(icons)).toContain(toIconType('Command'));
    expect(toIconType('__esModule')).toBe('Command');
    expect(toIconType('constructor')).toBe('Command');
    expect(toIconType('NotARealIcon')).toBe('Command');
  });
});

// The static command lists name icons from the client's bundled set. The
// shared package asserts every entry *has* an icon, but only this package
// knows whether a name resolves — a typo like "Chekmark" would pass there and
// silently degrade to the generic glyph. This is the only package that depends
// on the icon set, so the resolvability contract lives here.
describe('static command lists', () => {
  const harnesses = Object.keys(
    STATIC_MANIFESTS
  ) as (keyof typeof STATIC_MANIFESTS)[];

  it('covers every harness', () => {
    expect(harnesses).toEqual(['openclaw', 'hermes']);
  });

  it.each(harnesses)('every %s icon resolves to a real glyph', (harness) => {
    const { commands } = STATIC_MANIFESTS[harness];

    expect(commands.length).toBeGreaterThan(0);
    for (const entry of commands) {
      expect(entry.icon, `${entry.command} must carry an icon`).toBeTruthy();
      expect(
        toIconType(entry.icon),
        `${entry.command} icon "${entry.icon}" must resolve, not fall back`
      ).toBe(entry.icon);
    }
  });
});
