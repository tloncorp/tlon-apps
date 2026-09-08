import assert from 'node:assert/strict';
import vm from 'node:vm';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import {
  assessInputPaint,
  startInputPaint,
  finalizeInputPaint,
} from './scroll-stability-input-paint.mjs';
const require = createRequire(
  new URL('../apps/tlon-web/package.json', import.meta.url)
);
const { PNG } = require(
  join(
    dirname(require.resolve('playwright-core/package.json')),
    'lib/utilsBundle.js'
  )
);
function image(on, width = 30, height = 24, wide = false) {
  const p = new PNG({ width, height });
  p.data.fill(255);
  if (on)
    for (let y = 3; y < 22; y++)
      for (let x = 8; x < (wide ? 12 : 9); x++) {
        const i = (width * y + x) * 4;
        p.data[i] = p.data[i + 1] = p.data[i + 2] = 0;
      }
  return PNG.sync.write(p).toString('base64');
}
function fixture(draft = '') {
  const input = {
    originalScope: '/channel/calibration',
    inputId: 'composer',
    paintOwner: {
      token: 'retained-a',
      timeOrigin: 1234,
      scopeKey: '/channel/calibration',
      inputId: 'composer',
    },
    paintEpochs: [{ epoch: 0, time: 0, reason: 'retained-input' }],
  };
  const snapshot = (time) => ({
    time,
    valid: true,
    owner: 'retained-a',
    timeOrigin: 1234,
    scopeKey: input.originalScope,
    inputId: 'composer',
    draft,
    selection: { start: draft.length, end: draft.length },
    focused: true,
    composing: false,
    epoch: 0,
    clip: { x: 10, y: 20, width: 30, height: 24 },
    deviceScaleFactor: 1,
    scrollTop: 0,
    scrollLeft: 0,
    style: 'unchanged',
  });
  const frames = Array.from({ length: 31 }, (_, i) => ({
    before: snapshot(i * 50),
    after: snapshot(i * 50 + 20),
    pngBase64: image(i < 10 || i >= 20),
  }));
  const contract = {
    start: 0,
    end: 1520,
    phases: [{ id: 'stable', start: 0, end: 1520, expected: snapshot(0) }],
  };
  return { raw: { version: 1, frames }, contract, input };
}
const assess = (f) => assessInputPaint(f.raw, f.contract, f.input);
const codes = (f) => assess(f).issues.map((i) => i.code);
for (const draft of ['', 'ab', 'ab\n', '👨‍👩‍👧\n'])
  test(`recurring pixels for exact ${JSON.stringify(draft)} remain partial observations`, () => {
    const result = assess(fixture(draft));
    assert.equal(result.candidates.length, 1);
    assert.deepEqual(result.candidates[0].rect, {
      x: 18,
      y: 23,
      width: 1,
      height: 19,
    });
    assert.equal(result.verdict, 'INCOMPLETE');
    assert.equal(result.presentedFrames, 'INCOMPLETE');
    assert.deepEqual(
      result.issues.map((i) => i.code),
      ['input-caret-paint-attribution-unqualified']
    );
  });
for (const change of ['scopeKey', 'owner', 'timeOrigin', 'inputId', 'epoch'])
  test(`cannot reuse ${change} from another owner`, () => {
    const f = fixture();
    for (const frame of f.raw.frames)
      for (const edge of ['before', 'after'])
        frame[edge][change] =
          change === 'epoch' || change === 'timeOrigin' ? 99 : 'other';
    assert.equal(assess(f).candidates.length, 0);
    assert(codes(f).includes('input-caret-paint-owner-or-state-changed'));
  });
for (const fault of ['focus', 'composing', 'draft', 'selection'])
  test(`stable wrong ${fault} never provides a phase candidate`, () => {
    const f = fixture('ab');
    for (const frame of f.raw.frames)
      for (const edge of ['before', 'after']) {
        if (fault === 'focus') frame[edge].focused = false;
        if (fault === 'composing') frame[edge].composing = true;
        if (fault === 'draft') frame[edge].draft = 'cd';
        if (fault === 'selection') frame[edge].selection = { start: 1, end: 1 };
      }
    assert.equal(assess(f).candidates.length, 0);
    assert(codes(f).includes('input-caret-paint-phase-state-mismatch'));
  });
test('explicit selected phase stays incomplete without inventing a caret', () => {
  const f = fixture('ab');
  f.contract.phases[0].expected.selection = { start: 0, end: 2 };
  for (const frame of f.raw.frames)
    for (const edge of ['before', 'after'])
      frame[edge].selection = { start: 0, end: 2 };
  assert(codes(f).includes('input-caret-paint-selection-not-collapsed'));
  assert.equal(assess(f).candidates.length, 0);
});
test('action ABA inside every PNG is detected despite identical final draft', () => {
  const f = fixture();
  f.input.paintEpochs = [{ epoch: 0, time: 0 }];
  for (let i = 0; i < f.raw.frames.length; i++) {
    const frame = f.raw.frames[i];
    frame.before.epoch = i;
    frame.after.epoch = i + 1;
    f.input.paintEpochs.push({ epoch: i + 1, time: frame.before.time + 10 });
  }
  assert.equal(assess(f).candidates.length, 0);
  assert(codes(f).includes('input-caret-paint-owner-or-state-changed'));
});
for (const fault of ['no-blink', 'three-states', 'wide-paint'])
  test(`${fault} is not attributed to a caret`, () => {
    const f = fixture();
    if (fault === 'no-blink')
      f.raw.frames.forEach((frame) => (frame.pngBase64 = image(true)));
    if (fault === 'three-states')
      f.raw.frames[15].pngBase64 = image(true, 30, 24, true);
    if (fault === 'wide-paint')
      f.raw.frames.forEach(
        (frame, i) => (frame.pngBase64 = image(i < 10 || i >= 20, 30, 24, true))
      );
    assert.equal(assess(f).candidates.length, 0);
    assert(
      codes(f).includes('input-caret-paint-blink-unavailable-or-ambiguous')
    );
  });
for (const fault of ['bracket', 'interval', 'reversed', 'nonfinite'])
  test(`${fault} capture timing cannot qualify`, () => {
    const f = fixture();
    if (fault === 'bracket')
      f.raw.frames.forEach(
        (frame) => (frame.after.time = frame.before.time + 101)
      );
    if (fault === 'interval')
      f.raw.frames = f.raw.frames.filter((_, i) => i % 3 === 0);
    if (fault === 'reversed') f.raw.frames.reverse();
    if (fault === 'nonfinite') f.raw.frames[0].before.time = NaN;
    assert(
      codes(f).some((code) =>
        [
          'input-caret-paint-capture-gap',
          'input-caret-paint-owner-or-state-changed',
        ].includes(code)
      )
    );
  });
test('exact 100ms capture boundary remains eligible', () => {
  const f = fixture();
  f.raw.frames = f.raw.frames.filter((_, i) => i % 2 === 0);
  f.raw.frames.forEach((frame) => (frame.after.time = frame.before.time + 100));
  f.contract.end = f.contract.phases[0].end = 1600;
  assert.equal(assess(f).candidates.length, 1);
  assert(!codes(f).includes('input-caret-paint-capture-gap'));
});
for (const fault of ['start', 'tail', 'phase'])
  test(`uncovered ${fault} retained`, () => {
    const f = fixture();
    if (fault === 'start') f.raw.frames.splice(0, 5);
    if (fault === 'tail') f.raw.frames.splice(-5);
    if (fault === 'phase')
      f.contract.phases.unshift({
        ...f.contract.phases[0],
        id: 'missing',
        start: -200,
        end: -150,
      });
    assert(codes(f).some((code) => /uncovered|unobserved/.test(code)));
  });
for (const fault of ['malformed', 'dimensions', 'crc', 'oversized-header'])
  test(`PNG ${fault} rejected before candidate`, () => {
    const f = fixture();
    f.raw.frames.forEach((frame) => {
      if (fault === 'malformed') frame.pngBase64 = 'not png';
      if (fault === 'dimensions') frame.pngBase64 = image(true, 40, 24);
      if (fault === 'crc' || fault === 'oversized-header') {
        const bytes = Buffer.from(frame.pngBase64, 'base64');
        if (fault === 'crc') bytes[29] ^= 255;
        else bytes.writeUInt32BE(0x7fffffff, 16);
        frame.pngBase64 = bytes.toString('base64');
      }
    });
    assert.equal(assess(f).candidates.length, 0);
    assert(codes(f).includes('input-caret-paint-png-invalid'));
  });
test('invalid owner/epoch contract is explicitly incomplete', () => {
  const f = fixture();
  f.input.paintEpochs[0].epoch = 3;
  assert(codes(f).includes('input-caret-paint-missing-or-invalid-binding'));
});

function deferred() {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
}
const turn = () => new Promise((resolve) => setImmediate(resolve));
function v2Fixture() {
  const f = fixture();
  f.raw.version = 2;
  f.raw.transport = 'cdp-page-capture-screenshot';
  f.raw.requestClock = 'node-performance';
  for (const frame of f.raw.frames) {
    frame.request = {
      startedAt: frame.before.time + 5000,
      returnedAt: frame.after.time + 5000,
    };
    for (const edge of ['before', 'after'])
      frame[edge].viewport = {
        pageX: 0,
        pageY: 0,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        width: 500,
        height: 400,
      };
  }
  return f;
}
test('new transport retains PNG candidate without promoting presentation', () => {
  const f = v2Fixture();
  assert.equal(assess(f).candidates.length, 1);
  assert.equal(assess(f).presentedFrames, 'INCOMPLETE');
});
for (const fault of [
  'transport',
  'clock',
  'nonfinite',
  'reversed',
  'request-gap',
  'viewport',
])
  test(`new transport ${fault} cannot qualify a candidate`, () => {
    const f = v2Fixture();
    if (fault === 'transport') f.raw.transport = 'unknown';
    if (fault === 'clock') f.raw.requestClock = 'presentation';
    for (const frame of f.raw.frames) {
      if (fault === 'nonfinite') frame.request.returnedAt = NaN;
      if (fault === 'reversed')
        frame.request.returnedAt = frame.request.startedAt - 1;
      if (fault === 'request-gap')
        frame.request.returnedAt = frame.request.startedAt + 101;
      if (fault === 'viewport') frame.after.viewport.pageY = 1;
    }
    assert.equal(assess(f).candidates.length, 0);
  });
test('ordinary evidence freezes before pending paint finalization', async () => {
  const core = await import('./scroll-stability-input-paint.cjs').then(
    (m) => m.default
  );
  const wait = deferred();
  const events = [];
  const done = core.finalizeInputPaint(
    () => {
      events.push('ordinary-freeze');
      return Promise.resolve({ samples: ['frozen'] });
    },
    {
      stop: () => {
        events.push('paint-stop');
        return wait.promise;
      },
    }
  );
  assert.deepEqual(events, ['ordinary-freeze', 'paint-stop']);
  await turn();
  wait.resolve({ version: 2, frames: [] });
  const raw = await done;
  assert.deepEqual(raw.samples, ['frozen']);
  assert(raw.paintedCaret);
});
test('ordinary freeze failure still retires pending paint', async () => {
  const core = await import('./scroll-stability-input-paint.cjs').then(
    (m) => m.default
  );
  let stopped = false;
  await assert.rejects(
    core.finalizeInputPaint(
      () => {
        throw new Error('ordinary freeze failed');
      },
      {
        stop: async () => {
          stopped = true;
          return { frames: [] };
        },
      }
    ),
    /ordinary freeze failed/
  );
  assert(stopped);
});
for (const failure of ['throw', 'reject'])
  test(`optional cleanup ${failure} cannot discard frozen ordinary evidence`, async () => {
    const core = await import('./scroll-stability-input-paint.cjs').then(
      (m) => m.default
    );
    const raw = await core.finalizeInputPaint(
      async () => ({ samples: ['frozen'] }),
      {
        stop() {
          if (failure === 'throw') throw new Error('paint cleanup failed');
          return Promise.reject(new Error('paint cleanup failed'));
        },
      }
    );
    assert.deepEqual(raw.samples, ['frozen']);
    assert.match(raw.paintedCaret.frames[0].error, /paint cleanup failed/);
  });
test('out-of-order Node request ledger cannot support recurring pixel candidates', () => {
  const f = v2Fixture();
  for (const frame of f.raw.frames)
    frame.request = { startedAt: 50, returnedAt: 60 };
  assert.equal(assess(f).candidates.length, 0);
});

function v3Fixture({ fractional = false, outsideOnly = false } = {}) {
  const f = v2Fixture();
  f.raw.version = 3;
  f.raw.captureRegion = 'viewport';
  for (const [i, frame] of f.raw.frames.entries()) {
    for (const edge of ['before', 'after']) {
      frame[edge].viewport.width = 100;
      frame[edge].viewport.height = 80;
      if (fractional)
        frame[edge].clip = { x: 10.25, y: 20.25, width: 30, height: 24 };
    }
    const p = new PNG({ width: 100, height: 80 });
    p.data.fill(255);
    // Unrelated page paint changes on every screenshot; it must stay outside ROI.
    p.data[0] = i;
    if (!outsideOnly && (i < 10 || i >= 20))
      for (let y = 23; y < 42; y++) {
        const k = (100 * y + 18) * 4;
        p.data[k] = p.data[k + 1] = p.data[k + 2] = 0;
      }
    frame.pngBase64 = PNG.sync.write(p).toString('base64');
  }
  f.input.paintSurface = {
    viewport: structuredClone(f.raw.frames[0].before.viewport),
    deviceScaleFactor: 1,
  };
  return f;
}
for (const fractional of [false, true])
  test(`viewport PNG is cropped only in reader with exact ${fractional ? 'fractional' : 'integer'} ROI origin`, () => {
    const f = v3Fixture({ fractional });
    const retained = f.raw.frames.map((x) => x.pngBase64);
    const result = assess(f);
    assert.equal(result.candidates.length, 1);
    assert.deepEqual(result.candidates[0].rect, {
      x: 18,
      y: 23,
      width: 1,
      height: 19,
    });
    assert.equal(result.presentedFrames, 'INCOMPLETE');
    assert.deepEqual(
      f.raw.frames.map((x) => x.pngBase64),
      retained
    );
    assert.deepEqual(
      result.issues.map((x) => x.code),
      ['input-caret-paint-attribution-unqualified']
    );
  });
test('changing viewport paint outside ROI cannot manufacture caret pixels', () => {
  const f = v3Fixture({ outsideOnly: true });
  assert.equal(assess(f).candidates.length, 0);
  assert(codes(f).includes('input-caret-paint-blink-unavailable-or-ambiguous'));
});
for (const fault of [
  'missing-surface',
  'region',
  'initial-dpr',
  'initial-width',
  'first-bracket-dpr',
  'first-bracket-height',
  'stable-later-resize',
  'negative-origin',
  'oversized-roi',
  'clipped-png',
  'wrong-full-size',
  'crc',
  'roi-third-state',
])
  test(`viewport transport rejects ${fault}`, () => {
    const f = v3Fixture();
    if (fault === 'missing-surface') delete f.input.paintSurface;
    if (fault === 'region') f.raw.captureRegion = 'clip';
    if (fault === 'initial-dpr') f.input.paintSurface.deviceScaleFactor = 2;
    if (fault === 'initial-width') f.input.paintSurface.viewport.width = 101;
    if (fault === 'first-bracket-dpr')
      f.raw.frames[0].after.deviceScaleFactor = 2;
    if (fault === 'first-bracket-height')
      f.raw.frames[0].after.viewport.height = 79;
    if (fault === 'stable-later-resize')
      for (const frame of f.raw.frames.slice(1))
        for (const edge of ['before', 'after'])
          frame[edge].viewport.height = 79;
    if (fault === 'negative-origin')
      for (const frame of f.raw.frames)
        for (const edge of ['before', 'after']) frame[edge].clip.x = -1;
    if (fault === 'oversized-roi')
      for (const frame of f.raw.frames)
        for (const edge of ['before', 'after']) frame[edge].clip.width = 100;
    if (fault === 'clipped-png')
      for (const frame of f.raw.frames) frame.pngBase64 = image(true);
    if (fault === 'wrong-full-size')
      for (const frame of f.raw.frames) frame.pngBase64 = image(true, 99, 80);
    if (fault === 'crc')
      for (const frame of f.raw.frames) {
        const b = Buffer.from(frame.pngBase64, 'base64');
        b[b.length - 1] ^= 1;
        frame.pngBase64 = b.toString('base64');
      }
    if (fault === 'roi-third-state') {
      const frame = f.raw.frames[15];
      const p = PNG.sync.read(Buffer.from(frame.pngBase64, 'base64'));
      p.data[(100 * 30 + 25) * 4] = 0;
      frame.pngBase64 = PNG.sync.write(p).toString('base64');
    }
    assert.equal(assess(f).candidates.length, 0);
    assert(
      codes(f).some((x) => x !== 'input-caret-paint-attribution-unqualified')
    );
  });

// Actual installed public screenshot preparation and Chromium dispatch.
// Frame, font readiness and protocol delivery are modeled; no browser is opened.
const playwrightRoot = dirname(require.resolve('playwright-core/package.json'));
const { Screenshotter } = require(
  join(playwrightRoot, 'lib/server/screenshotter.js')
);
const { CRPage } = require(
  join(playwrightRoot, 'lib/server/chromium/crPage.js')
);
const surface = {
  deviceScaleFactor: 1,
  viewport: {
    pageX: 0,
    pageY: 0,
    offsetX: 0,
    offsetY: 0,
    scale: 1,
    width: 100,
    height: 80,
  },
};
const snap = (time) => ({
  time,
  valid: true,
  owner: 'retained',
  timeOrigin: 123,
  scopeKey: 'scope',
  inputId: 'input',
  draft: 'abc',
  selection: { start: 3, end: 3 },
  focused: true,
  composing: false,
  epoch: 0,
  clip: { x: 10, y: 20, width: 30, height: 24 },
  ...structuredClone(surface),
  scrollTop: 0,
  scrollLeft: 0,
  style: 'unchanged',
});
function png(on, width = 100, height = 80) {
  const p = new PNG({ width, height });
  p.data.fill(255);
  if (on)
    for (let y = 23; y < 42; y++) {
      const i = (y * width + 18) * 4;
      p.data[i] = p.data[i + 1] = p.data[i + 2] = 0;
    }
  return PNG.sync.write(p);
}
function rig(options = {}) {
  const calls = [];
  const ctx = vm.createContext({
    window: {},
    document: new Proxy(
      {},
      {
        get() {
          throw Error('Unexpected DOM access/mutation');
        },
      }
    ),
  });
  const client = {
    send: async (method, params) => {
      calls.push({ method, params });
      if (method === 'Page.getLayoutMetrics')
        return { visualViewport: { pageX: 0, pageY: 0, scale: 1 } };
      assert.equal(method, 'Page.captureScreenshot');
      if (options.capture) return options.capture();
      return { data: png(true).toString('base64') };
    },
  };
  const delegate = {
    _mainFrameSession: { _client: client },
    _browserContext: { _options: { deviceScaleFactor: options.dpr ?? 1 } },
    takeScreenshot: CRPage.prototype.takeScreenshot,
    shouldToggleStyleSheetToSyncAnimations:
      CRPage.prototype.shouldToggleStyleSheetToSyncAnimations,
  };
  const frame = {
    nonStallingEvaluateInExistingContext: async (expression) => {
      assert.equal(expression, 'document.fonts.ready');
      calls.push({ method: 'fonts' });
      if (options.fonts) await options.fonts;
    },
  };
  const serverPage = {
    _delegate: delegate,
    viewportSize: () => ({ width: 100, height: 80 }),
    mainFrame: () => frame,
    safeNonStallingEvaluateInAllFrames: async (expression) => {
      calls.push({ method: 'evaluate', expression });
      return vm.runInContext(expression, ctx);
    },
  };
  const progress = {
    log: () => {},
    throwIfAborted: () => {},
    cleanupWhenAborted: () => {},
  };
  const screenshotter = new Screenshotter(serverPage);
  const page = {
    screenshot: async (opts) => {
      calls.push({ method: 'public', options: opts });
      return screenshotter.screenshotPage(progress, opts);
    },
    context() {
      throw Error('Dedicated session is forbidden');
    },
  };
  let i = 0;
  const observe =
    options.observe ??
    (async () => {
      if (i >= 2) throw Error('control ended');
      return snap(i++ * 20);
    });
  return {
    page,
    observe,
    calls,
    client,
    ctx,
    screenshotter,
    progress,
    start: () =>
      startInputPaint(page, observe, {
        timeoutMs: 20,
        ownsPage: async () => true,
      }),
  };
}
test('collector invokes only exact public natural-paint viewport options', async () => {
  const r = rig(),
    c = r.start();
  await turn();
  const raw = await c.stop();
  assert.equal(raw.version, 4);
  assert.equal(raw.transport, 'playwright-page-screenshot');
  assert.equal(raw.pixelScale, 'css');
  assert.equal(raw.captureRegion, 'viewport');
  assert.deepEqual(r.calls.find((x) => x.method === 'public').options, {
    type: 'png',
    caret: 'initial',
    animations: 'allow',
    fullPage: false,
    scale: 'css',
    timeout: 20,
  });
  assert(raw.frames[0].pngBase64);
  assert.deepEqual(
    r.calls.filter((x) => x.method.startsWith('Page.')).map((x) => x.method),
    ['Page.getLayoutMetrics', 'Page.captureScreenshot']
  );
});
for (const dpr of [1, 2])
  test(`installed Screenshotter/CRPage retain owner session and CSS mapping at DPR${dpr}`, async () => {
    const r = rig({ dpr });
    await r.page.screenshot({
      type: 'png',
      caret: 'initial',
      animations: 'allow',
      fullPage: false,
      scale: 'css',
      timeout: 250,
    });
    const call = r.calls.find((x) => x.method === 'Page.captureScreenshot');
    assert.deepEqual(call.params, {
      format: 'png',
      quality: undefined,
      clip: { x: 0, y: 0, width: 100, height: 80, scale: 1 / dpr },
      captureBeyondViewport: false,
    });
    assert.equal(r.calls.filter((x) => x.method === 'fonts').length, 1);
    assert.deepEqual(Object.keys(r.ctx.window), []);
  });
test('actual public preparation waits for fonts before any capture; no bypass', async () => {
  const wait = deferred(),
    r = rig({ fonts: wait.promise });
  const p = r.page.screenshot({
    caret: 'initial',
    animations: 'allow',
    fullPage: false,
    scale: 'css',
    timeout: 250,
  });
  await turn();
  assert(r.calls.some((x) => x.method === 'fonts'));
  assert(!r.calls.some((x) => x.method === 'Page.captureScreenshot'));
  wait.resolve();
  await p;
  assert(r.calls.some((x) => x.method === 'Page.captureScreenshot'));
});
test('actual screenshot queue remains serialized; collector cannot claim cancellation', async () => {
  const wait = deferred(),
    r = rig({ capture: () => wait.promise });
  const opts = {
    caret: 'initial',
    animations: 'allow',
    fullPage: false,
    scale: 'css',
  };
  const a = r.page.screenshot(opts),
    b = r.page.screenshot(opts);
  await turn();
  assert.equal(
    r.calls.filter((x) => x.method === 'Page.captureScreenshot').length,
    1
  );
  wait.resolve({ data: png(true).toString('base64') });
  await Promise.all([a, b]);
  assert.equal(
    r.calls.filter((x) => x.method === 'Page.captureScreenshot').length,
    2
  );
});
test('stalled fonts stop optional collection within outer bound, no retry', async () => {
  const wait = deferred(),
    r = rig({ fonts: wait.promise });
  const c = r.start();
  await turn();
  const raw = await c.stop();
  assert(raw.frames.some((f) => /timed out/i.test(f.error)));
  assert.equal(r.calls.filter((x) => x.method === 'public').length, 1);
  wait.resolve();
  await turn();
});
test('public capture error retains reason and does not retry', async () => {
  const r = rig({
      capture: async () => {
        throw Error('native screenshot rejected');
      },
    }),
    c = r.start();
  await turn();
  const raw = await c.stop();
  assert.match(raw.frames[0].error, /native screenshot rejected/);
  assert.equal(r.calls.filter((x) => x.method === 'public').length, 1);
});
test('retirement excludes late delivered bytes without closing page', async () => {
  const wait = deferred(),
    r = rig({ capture: () => wait.promise }),
    c = r.start();
  await turn();
  const stop = c.stop();
  wait.resolve({ data: png(true).toString('base64') });
  const raw = await stop;
  assert.match(raw.frames[0].error, /retired/);
  assert(raw.frames[0].pngBase64);
  assert(!raw.frames[0].after);
});
test('ordinary freeze starts before pending public screenshot settles', async () => {
  const wait = deferred(),
    r = rig({ capture: () => wait.promise }),
    c = r.start();
  await turn();
  let frozen = false;
  const done = finalizeInputPaint(async () => {
    frozen = true;
    return { samples: ['fixed'] };
  }, c);
  assert(frozen);
  wait.resolve({ data: png(true).toString('base64') });
  assert.deepEqual((await done).samples, ['fixed']);
});
for (const fault of ['bracket', 'gap'])
  test(`unchanged 100ms ${fault} remains a hard stop`, async () => {
    let i = 0;
    const times = fault === 'bracket' ? [0, 101] : [0, 20, 101];
    const r = rig({ observe: async () => snap(times[i++] ?? 200) }),
      c = r.start();
    await turn();
    const raw = await c.stop();
    assert(raw.frames.some((f) => /100 ms/.test(f.error)));
    assert.equal(r.calls.filter((x) => x.method === 'public').length, 1);
  });
function publicFixture(dpr = 1) {
  const input = {
    originalScope: 'scope',
    inputId: 'input',
    paintOwner: {
      token: 'retained',
      timeOrigin: 123,
      scopeKey: 'scope',
      inputId: 'input',
    },
    paintSurface: { ...structuredClone(surface), deviceScaleFactor: dpr },
    paintEpochs: [{ epoch: 0, time: 0 }],
  };
  const frames = Array.from({ length: 31 }, (_, i) => ({
    before: { ...snap(i * 50), deviceScaleFactor: dpr },
    after: { ...snap(i * 50 + 20), deviceScaleFactor: dpr },
    request: { startedAt: 5000 + i * 50, returnedAt: 5020 + i * 50 },
    pngBase64: png(i < 10 || i >= 20).toString('base64'),
  }));
  return {
    raw: {
      version: 4,
      transport: 'playwright-page-screenshot',
      captureRegion: 'viewport',
      pixelScale: 'css',
      requestClock: 'node-performance',
      frames,
    },
    input,
    contract: {
      start: 0,
      end: 1520,
      phases: [{ id: 'held', start: 0, end: 1520, expected: snap(0) }],
    },
  };
}
for (const dpr of [1, 2])
  test(`CSS PNG reader crops exact ROI independently of DOM DPR${dpr}`, () => {
    const f = publicFixture(dpr),
      r = assessInputPaint(f.raw, f.contract, f.input);
    assert.deepEqual(r.candidates[0].rect, {
      x: 18,
      y: 23,
      width: 1,
      height: 19,
    });
    assert.equal(r.verdict, 'INCOMPLETE');
  });
for (const fault of [
  'transport',
  'scale',
  'surface',
  'owner',
  'dimensions',
  'large-bitmap',
])
  test(`public PNG evidence rejects ${fault}`, () => {
    const f = publicFixture();
    if (fault === 'transport') f.raw.transport = 'cdp-page-capture-screenshot';
    if (fault === 'scale') f.raw.pixelScale = 'device';
    if (fault === 'surface') f.raw.frames[0].after.viewport.height = 79;
    if (fault === 'owner')
      for (const frame of f.raw.frames) frame.after.owner = 'other';
    if (fault === 'dimensions')
      for (const frame of f.raw.frames)
        frame.pngBase64 = png(true, 99, 80).toString('base64');
    if (fault === 'large-bitmap')
      for (const frame of f.raw.frames) {
        const b = Buffer.from(frame.pngBase64, 'base64');
        b.writeUInt32BE(2560, 16);
        b.writeUInt32BE(1426, 20);
        frame.pngBase64 = b.toString('base64');
      }
    assert.equal(
      assessInputPaint(f.raw, f.contract, f.input).candidates.length,
      0
    );
  });
