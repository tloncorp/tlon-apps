import * as icons from '@tloncorp/ui/assets/icons';
import fs from 'node:fs';
import path from 'node:path';
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

// The runtimes' committed manifest fixtures name icons from the client's
// bundled set. Registry-side tests assert every advertised row *has* an icon,
// but only the client knows whether a name resolves — a typo like "Chekmark"
// would pass both runtimes' suites and silently degrade to the generic glyph.
// This is the only package that depends on the icon set, so the resolvability
// contract lives here, reading the fixtures by relative path (same pattern as
// openclaw's nudge-settings contract test).
describe('runtime manifest fixtures', () => {
  const here = __dirname;
  const fixtures = [
    ['openclaw', '../../../openclaw/fixtures/command-manifest.json'],
    [
      'hermes-tlon-adapter',
      '../../../hermes-tlon-adapter/fixtures/command-manifest.json',
    ],
  ] as const;

  it.each(fixtures)(
    'every %s fixture icon resolves to a real glyph',
    (_name, rel) => {
      const manifest = JSON.parse(
        fs.readFileSync(path.resolve(here, rel), 'utf8')
      ) as { commands: { command: string; icon?: string }[] };

      expect(manifest.commands.length).toBeGreaterThan(0);
      for (const entry of manifest.commands) {
        expect(entry.icon, `${entry.command} must carry an icon`).toBeTruthy();
        expect(
          toIconType(entry.icon),
          `${entry.command} icon "${entry.icon}" must resolve, not fall back`
        ).toBe(entry.icon);
      }
    }
  );
});
