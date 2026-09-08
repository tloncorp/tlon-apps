import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { assessPendingThreadShell } from '../apps/tlon-web/e2e/helpers/threadLoadingShell.ts';
import { startScrollNavigationTrace } from '../apps/tlon-web/e2e/helpers/scrollNavigation.ts';
const require = createRequire(
  new URL('../packages/app/package.json', import.meta.url)
);
const { JSDOM } = require('jsdom');
const box = { left: 410, right: 454, top: 20, bottom: 64 };
const metric = { exposed: true, opacity: 1, rect: box, clip: box };
function fixture() {
  const shell = {
    identity: 1,
    ...metric,
    texts: [{ text: 'Loading thread…', ...metric }],
    titles: [{ text: 'Thread', ...metric }],
    progressCount: 1,
    back: [{ ...metric, disabled: false, pointerEvents: 'auto', hit: true }],
  };
  const raw = {
    events: [
      { kind: 'click', time: 100, trusted: true },
      { kind: 'popstate', time: 450, trusted: true },
    ],
    samples: Array.from({ length: 91 }, (_, i) => ({
      time: i * 20,
      durationMs: 1,
      documentVisible: true,
      route: i * 20 >= 200 && i * 20 < 450 ? '/thread' : '/channel',
      threadShells:
        i * 20 >= 200 && i * 20 < 450 ? [structuredClone(shell)] : [],
    })),
  };
  const plan = {
    scopes: { thread: { route: '/thread' }, channel: { route: '/channel' } },
    maxGapMs: 100,
    maxMeasurementMs: 32,
    maxOutgoingMs: 250,
    completionMs: 1000,
    quietTailMs: 1000,
    tolerancePx: 1,
  };
  const pending = {
    kind: 'missing-parent',
    requests: [{ interceptedTime: 200, releasedTime: 600 }],
  };
  return { raw, plan, pending };
}
const evaluate = (change) => {
  const f = fixture();
  change?.(f);
  return assessPendingThreadShell(f.raw, f.plan, f.pending);
};
test('continuous exact pending shell qualifies only its declared sampled affordance', () => {
  const r = evaluate();
  assert.equal(r.verdict, 'PASS');
  assert.equal(r.backActivation, 'UNEXECUTED');
  assert.equal(r.errorAndRetry, 'UNEXECUTED');
  assert.equal(r.presentedFrames, 'INCOMPLETE');
});
for (const [name, change, code] of [
  [
    'brief blank',
    (f) => (f.raw.samples[12].threadShells = []),
    'missing-or-duplicate-current-shell',
  ],
  [
    'duplicate shell',
    (f) =>
      f.raw.samples[12].threadShells.push(
        structuredClone(f.raw.samples[12].threadShells[0])
      ),
    'missing-or-duplicate-current-shell',
  ],
  [
    'stale pending label',
    (f) =>
      (f.raw.samples[12].threadShells[0].texts[0].text =
        'Could not load this thread.'),
    'wrong-or-hidden-pending-shell',
  ],
  [
    'hidden label',
    (f) => (f.raw.samples[12].threadShells[0].texts[0].opacity = 0),
    'wrong-or-hidden-pending-shell',
  ],
  [
    'unrelated progress',
    (f) => (f.raw.samples[12].threadShells[0].progressCount = 0),
    'wrong-or-hidden-pending-shell',
  ],
  [
    'covered Back',
    (f) => (f.raw.samples[12].threadShells[0].back[0].hit = false),
    'hidden-clipped-or-obstructed-back',
  ],
  [
    'disabled Back',
    (f) => (f.raw.samples[12].threadShells[0].back[0].disabled = true),
    'hidden-clipped-or-obstructed-back',
  ],
  [
    'clipped Back',
    (f) =>
      (f.raw.samples[12].threadShells[0].back[0].clip = {
        ...f.raw.samples[12].threadShells[0].back[0].clip,
        top: 22,
      }),
    'hidden-clipped-or-obstructed-back',
  ],
  [
    'missing Back',
    (f) => (f.raw.samples[12].threadShells[0].back = []),
    'missing-or-duplicate-shell-back',
  ],
  [
    'late shell reappearance',
    (f) =>
      (f.raw.samples[40].threadShells = structuredClone(
        f.raw.samples[12].threadShells
      )),
    'shell-reappeared-after-back',
  ],
  [
    'missing capture field',
    (f) => delete f.raw.samples[12].threadShells,
    'incomplete-shell-acquisition',
  ],
  [
    'invalid acquisition',
    (f) => (f.raw.samples[12].durationMs = 33),
    'incomplete-shell-acquisition',
  ],
  [
    'short pending interval',
    (f) => (f.pending.requests[0].interceptedTime = 400),
    'invalid-shell-slice-contract',
  ],
  [
    'weakened gap criterion',
    (f) => (f.plan.maxGapMs = 1000),
    'invalid-shell-slice-contract',
  ],
])
  test('rejects ' + name, () => {
    const r = evaluate(change);
    assert.notEqual(r.verdict, 'PASS');
    assert.ok(
      r.issues.some((i) => i.code === code),
      JSON.stringify(r)
    );
  });

// Invoke the actual page-owned collector on a deterministic DOM boundary.
// These controls validate collection, not actual browser layout or presentation.
for (const defect of ['healthy', 'covered', 'hidden'])
  test('actual collector sees ' + defect + ' shell/Back', async () => {
    const dom = new JSDOM(
      '<div data-testid="PostScreenLoadingShell"><span data-testid="ScreenHeaderTitle">Thread</span><div data-testid="HeaderBackButton"></div><span role="progressbar"></span><span id="pending-label">Loading thread…</span></div><div id="cover"></div>',
      { url: 'http://localhost:3000/thread' }
    );
    const w = dom.window,
      d = w.document,
      shell = d.querySelector('[data-testid="PostScreenLoadingShell"]'),
      back = d.querySelector('[data-testid="HeaderBackButton"]'),
      title = d.querySelector('[data-testid="ScreenHeaderTitle"]'),
      label = d.querySelector('#pending-label'),
      progress = d.querySelector('[role]'),
      cover = d.querySelector('#cover');
    const rects = new Map([
      [shell, [400, 0, 800, 800]],
      [back, [410, 20, 44, 44]],
      [title, [700, 20, 80, 30]],
      [label, [680, 380, 180, 25]],
      [progress, [760, 350, 20, 20]],
    ]);
    w.Element.prototype.getBoundingClientRect = function () {
      return new w.DOMRect(...(rects.get(this) ?? [0, 0, 1280, 800]));
    };
    Object.defineProperty(d, 'visibilityState', { value: 'visible' });
    d.elementFromPoint = (x, y) => {
      for (const el of [back, title, label, progress]) {
        const r = el.getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom)
          return defect === 'covered' && el === back ? cover : el;
      }
      return shell;
    };
    if (defect === 'hidden') shell.style.opacity = '0';
    const globals = {
      document: d,
      window: w,
      Element: w.Element,
      NodeFilter: w.NodeFilter,
      location: w.location,
      MutationObserver: w.MutationObserver,
      innerWidth: 1280,
      innerHeight: 800,
      requestAnimationFrame: () => 1,
      cancelAnimationFrame: () => {},
      getComputedStyle: (el) => {
        const s = w.getComputedStyle(el);
        return new Proxy(s, {
          get(t, k) {
            const defaults = {
              opacity: '1',
              visibility: 'visible',
              display: 'block',
              contentVisibility: 'visible',
              pointerEvents: 'auto',
            };
            return t[k] || defaults[k] || '';
          },
        });
      },
    };
    const previous = new Map(
      Object.keys(globals).map((k) => [
        k,
        Object.getOwnPropertyDescriptor(globalThis, k),
      ])
    );
    try {
      for (const [k, v] of Object.entries(globals))
        Object.defineProperty(globalThis, k, {
          value: v,
          configurable: true,
          writable: true,
        });
      const page = {
        evaluateHandle: async (fn, args) => {
          const value = fn(args);
          return {
            evaluate: async (fn, arg) => fn(value, arg),
            dispose: async () => {},
          };
        },
      };
      const capture = await startScrollNavigationTrace(
        page,
        { commands: [], scopes: {} },
        { left: 400, right: 1200, top: 0, bottom: 800 }
      );
      const raw = await capture.stop();
      assert.deepEqual(raw.errors, []);
      const s = raw.samples.at(-1).threadShells;
      assert.equal(s.length, 1);
      assert.equal(s[0].exposed, defect !== 'hidden');
      assert.equal(s[0].back[0].hit, defect !== 'covered');
      assert.ok(s[0].texts.some((t) => t.text === 'Loading thread…'));
      assert.equal(s[0].progressCount, defect === 'hidden' ? 0 : 1);
    } finally {
      for (const [k, old] of previous)
        if (old) Object.defineProperty(globalThis, k, old);
        else delete globalThis[k];
      dom.window.close();
    }
  });
