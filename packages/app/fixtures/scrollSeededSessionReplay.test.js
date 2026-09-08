import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { replaySeededSession } from '../../../scripts/scroll-stability-seeded-session-replay.mjs';
import {
  seededEvidence,
  moveSeededReadingSample,
} from './scrollSeededSessionTestData';

const declared = (p) =>
  structuredClone({
    plan: p.plan,
    session: p.session,
    initialRows: p.initialRows,
    pendingPlan: p.pendingPlan,
  });

describe('independent seeded raw replay', () => {
  it('recomputes actual source and binds the exact reader bytes', () => {
    const proof = seededEvidence();
    proof.attachedAssessment = { verdict: 'FAIL' };
    const result = replaySeededSession(proof, declared(proof));
    expect(result).toMatchObject({
      behaviorVerdict: 'PASS',
      verdict: 'INCOMPLETE',
    });
    const root = resolve(import.meta.dirname, '../../..');
    expect(
      result.sourceHashes['packages/app/fixtures/scrollSeededSession.ts']
    ).toBe(
      createHash('sha256')
        .update(
          readFileSync(
            resolve(root, 'packages/app/fixtures/scrollSeededSession.ts')
          )
        )
        .digest('hex')
    );
    expect(Object.keys(result.sourceHashes)).toEqual(
      expect.arrayContaining([
        'packages/app/fixtures/scrollNavigationTrace.ts',
        'packages/app/fixtures/scrollInputTrace.ts',
        'packages/app/fixtures/scrollReadingTrace.ts',
      ])
    );
  });
  it('cannot use an attached PASS to suppress a recovered actual point jump', () => {
    const proof = seededEvidence();
    proof.attachedAssessment = { verdict: 'PASS' };
    moveSeededReadingSample(proof.blocks[0].reading.samples[30]);
    expect(replaySeededSession(proof, declared(proof))).toMatchObject({
      verdict: 'FAIL',
      behaviorVerdict: 'FAIL',
    });
  });
  it('requires the separately retained pre-action declaration', () => {
    const proof = seededEvidence();
    expect(replaySeededSession(proof).behaviorVerdict).toBe('INCOMPLETE');
    const declaration = declared(proof);
    declaration.session.token = 'other-page';
    expect(replaySeededSession(proof, declaration).issues).toContainEqual({
      code: 'independent-pre-action-declaration-mismatch',
      kind: 'incomplete',
    });
  });
  it('retains a measured failure even when declaration provenance is absent', () => {
    const proof = seededEvidence();
    moveSeededReadingSample(proof.blocks[0].reading.samples[30]);
    expect(replaySeededSession(proof)).toMatchObject({
      verdict: 'FAIL',
      behaviorVerdict: 'FAIL',
    });
  });
});

// Execute the production finalization function without importing its unrelated
// Playwright setup. Only attachment/resource boundaries are modeled here.
describe('actual seeded helper unconditional finalization', () => {
  const loadFinalizer = async () => {
    const ts = await import('typescript');
    const source = readFileSync(
      resolve(
        import.meta.dirname,
        '../../../apps/tlon-web/e2e/helpers/scrollerSeededSession.ts'
      ),
      'utf8'
    );
    const ast = ts.createSourceFile(
      'helper.ts',
      source,
      ts.ScriptTarget.Latest,
      true
    );
    const fn = ast.statements.find(
      (node) =>
        ts.isFunctionDeclaration(node) &&
        node.name?.text === 'finalizeSeededSessionEvidence'
    );
    expect(fn, 'actual installed helper finalizer exists').toBeTruthy();
    expect(source).toContain('await finalizeSeededSessionEvidence(');
    const js = ts.transpileModule(fn.getText(ast), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    const exports = {};
    new Function('exports', js)(exports);
    return exports.finalizeSeededSessionEvidence;
  };
  it('runs both owned cleanups once after raw attachment failure and preserves all errors', async () => {
    const finalize = await loadFinalizer(),
      calls = [],
      proof = { errors: [] };
    const receipt = await finalize(
      {
        attach: async (name, data) => {
          calls.push(name);
          if (name === 'seeded-session-raw') throw Error('disk full');
          expect(JSON.parse(data.body).errors).toEqual([
            'Raw attachment: Error: disk full',
            'Presence cleanup: Error: clear failed',
            'Pending navigation/context cleanup: Error: close failed',
          ]);
        },
      },
      proof,
      true,
      async () => {
        calls.push('presence');
        throw Error('clear failed');
      },
      async () => {
        calls.push('fixture');
        throw Error('close failed');
      }
    );
    expect(calls).toEqual([
      'seeded-session-raw',
      'presence',
      'fixture',
      'seeded-session-cleanup',
    ]);
    expect(proof.errors).toEqual(receipt.errors);
    expect(proof.errors).toHaveLength(3);
  });
  it('retains cleanup attachment failure without re-clearing an inactive presence', async () => {
    const finalize = await loadFinalizer(),
      calls = [],
      proof = { errors: [] };
    await finalize(
      {
        attach: async (name) => {
          calls.push(name);
          if (name === 'seeded-session-cleanup') throw Error('receipt failed');
        },
      },
      proof,
      false,
      async () => {
        throw Error('must not clear');
      },
      async () => {
        calls.push('fixture');
      }
    );
    expect(calls).toEqual([
      'seeded-session-raw',
      'fixture',
      'seeded-session-cleanup',
    ]);
    expect(proof.errors).toEqual(['Cleanup attachment: Error: receipt failed']);
  });
});

// Run the actual orchestration body. Protocol-return cost is modeled separately
// from in-page freeze; no DOM or product geometry is inferred by these controls.
describe('actual seeded helper defers bulk exports until actions finish', () => {
  const run = async ({ failExport, failFreeze, failWheelMetrics } = {}) => {
    const ts = await import('typescript');
    const source = readFileSync(
      resolve(
        import.meta.dirname,
        '../../../apps/tlon-web/e2e/helpers/scrollerSeededSession.ts'
      ),
      'utf8'
    );
    const ast = ts.createSourceFile(
      'helper.ts',
      source,
      ts.ScriptTarget.Latest,
      true
    );
    const names = [
      'runSeededSession',
      'finalizeSeededSessionEvidence',
      'readWheelSurface',
    ];
    const functions = ast.statements.filter(
      (node) =>
        ts.isFunctionDeclaration(node) && names.includes(node.name?.text)
    );
    expect(functions).toHaveLength(3);
    const js = ts.transpileModule(
      functions.map((node) => node.getText(ast)).join('\n'),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      }
    ).outputText;
    const calls = [],
      captures = [],
      attachments = new Map();
    let clock = 0,
      latest = 0;
    const capture = (name, semantic = false) => {
      const entry = {
        name,
        frozen: false,
        raw: { name, samples: [{ time: clock }] },
      };
      captures.push(entry);
      const freeze = async () => {
        calls.push(`freeze:${name}`);
        if (name === failFreeze) throw Error(`freeze ${name}`);
        if (!entry.frozen) {
          entry.raw.samples.push({ time: clock });
          entry.frozen = true;
        }
      };
      const stop = async () => {
        calls.push(`export:${name}`);
        if (!entry.frozen) await freeze();
        clock += 500;
        calls.push(`dispose:${name}`);
        if (name === failExport) throw Error(`export ${name}`);
        return entry.raw;
      };
      return {
        freeze,
        stop,
        stopRaw: stop,
        begin: async () => {},
        end: async () => {},
        beginInput: async () => {},
        endInput: async () => {},
        markTerminal: async () => {
          calls.push(`terminal:${name}`);
          return clock;
        },
      };
    };
    const locator = {
      scrollIntoViewIfNeeded: async () => {},
      evaluate: async () => -100,
      boundingBox: async () => ({ x: 0, y: 0, width: 500, height: 500 }),
      first() {
        return this;
      },
      getByText() {
        return this;
      },
      elementHandle: async () => locator,
      focus: async () => {},
      fill: async () => {},
      press: async () => {},
      click: async () => {
        calls.push(`latest:${latest++}`);
        clock += 2;
      },
    };
    const page = {
      getByTestId: () => locator,
      getByText: () => locator,
      locator: () => locator,
      mouse: {
        move: async () => {},
        wheel: async (x, y) => {
          calls.push(`wheel:${x}:${y}`);
        },
      },
      context: () => ({
        newCDPSession: async () => ({
          send: async (method) => {
            calls.push(`cdp:${method}`);
            if (method === 'Browser.getVersion')
              return {
                product: 'Chrome/136.0.7103.25',
                revision: '@97d495678dc307bfe6d6475901104e262ec7a487',
                protocolVersion: '1.3',
              };
            if (method === 'Target.getTargetInfo')
              return {
                targetInfo: {
                  targetId: 'modeled-target',
                  type: 'page',
                  url: 'http://localhost:3000/channel/test',
                },
              };
            expect(method).toBe('Page.getLayoutMetrics');
            if (failWheelMetrics) throw Error('owned metrics unavailable');
            return {
              visualViewport: {
                clientWidth: 2560,
                clientHeight: 1600,
                scale: 1,
                zoom: 1,
                offsetX: 0,
                offsetY: 0,
              },
              cssVisualViewport: {
                clientWidth: 1280,
                clientHeight: 800,
                scale: 1,
                zoom: 1,
                offsetX: 0,
                offsetY: 0,
              },
            };
          },
          detach: async () => {
            calls.push('cdp:detach');
          },
        }),
      }),
      setViewportSize: async () => {},
      url: () => 'http://localhost:3000/channel/test',
      waitForTimeout: async (ms) => {
        clock += ms;
      },
      evaluate: async () => ({
        start: clock,
        time: clock,
        surface: {
          dpr: 1,
          width: 1280,
          height: 800,
          visualWidth: 1280,
          visualHeight: 800,
          visualScale: 1,
          visualX: 0,
          visualY: 0,
          topFrame: true,
        },
        timeOrigin: 1,
        origin: 'http://localhost:3000',
        scope: '/channel/test',
        declaredAt: clock,
        normalFlags: true,
        ship: 'zod',
      }),
    };
    const plan = {
      actions: [
        { kind: 'wheel', block: 0, wheelY: -560 },
        { kind: 'presence-show', block: 0 },
        { kind: 'latest', block: 0 },
        { kind: 'wheel', block: 1, wheelY: -560 },
        { kind: 'grow', block: 1, payload: 'draft' },
        { kind: 'select-all', block: 1 },
        { kind: 'delete', block: 1 },
        { kind: 'latest', block: 1 },
      ],
      blocks: [{ kind: 'thinking' }, { kind: 'composer' }],
      limits: { sequenceDeadlineMs: 100000 },
    };
    const fixture = {
      page,
      row: locator,
      proof: { parentId: 'post', expectedRows: {}, sourceChannel: 'chat/test' },
      channelRows: {},
      readerBackend: {},
      channelRoute: '/channel/test',
      threadRoute: '/thread/test',
      anchorText: 'text',
      cleanup: async () => {
        calls.push('fixture-cleanup');
      },
    };
    let readingIndex = 0;
    const dependency = {
      expect: () => ({
        toBe: () => {},
        toBeGreaterThan: () => {},
        toBeVisible: async () => {},
        toEqual: () => {},
      }),
      seededSessionPlan: () => plan,
      preparePendingNavigation: async () => fixture,
      helpers: {
        inviteMembersToGroup: async () => {},
        acceptGroupInvite: async () => {},
        navigateToChannel: async () => {},
      },
      resolvePostScroller: async () => locator,
      settlePostScroller: async () => {},
      readNavigationAnchor: async () => ({
        bottomGap: 200,
        rowId: 'post',
        viewport: {},
      }),
      readNavigationQueries: async () => ({ threadQueryPresent: false }),
      randomUUID: () => 'session',
      now: async () => clock,
      waitUntil: async (_, end) => {
        clock = Math.max(clock, end);
      },
      startScrollNavigationTrace: async () => capture('global'),
      observeActions: async () => {
        const events = {
          waitForWheel: async (start) => {
            calls.push('await-wheel-listener');
            clock += 8; // Non-blocking product listener runs after driver return.
            return {
              time: start,
              observedAt: clock,
              timeOrigin: 1,
              scope: '/channel/test',
            };
          },
          stop: () => {
            calls.push('events-stop');
            return { events: [], errors: [] };
          },
        };
        return {
          evaluate: async (fn, arg) => fn(events, arg),
          dispose: async () => {
            calls.push('events-dispose');
          },
        };
      },
      acquireReading: async () => ({
        capture: capture(`reading-${readingIndex++}`),
        contract: { coverage: {} },
      }),
      startConversationSemanticTrace: async () => capture('semantic', true),
      startScrollInputTrace: async () => capture('input'),
      setComputingPresence: async (_, active) => {
        if (!active) calls.push('presence-cleanup');
        return {};
      },
      readCenterEditWindow: async () => ({}),
      assessSeededSession: () => ({ issues: [] }),
    };
    const exports = {};
    new Function('exports', ...Object.keys(dependency), js)(
      exports,
      ...Object.values(dependency)
    );
    await exports.runSeededSession(
      page,
      page,
      { version: () => 'test' },
      {
        project: { use: { headless: true } },
        attach: async (name, value) => {
          attachments.set(name, JSON.parse(value.body));
        },
      },
      1,
      8
    );
    return { calls, captures, proof: attachments.get('seeded-session-raw') };
  };
  it('retains raw same-page CDP measurements around each unchanged wheel and detaches once', async () => {
    const { calls, proof } = await run();
    expect(calls.filter((c) => c.startsWith('wheel:'))).toEqual([
      'wheel:0:-100',
      'wheel:0:-560',
      'wheel:0:-560',
    ]);
    expect(calls.filter((c) => c === 'cdp:Page.getLayoutMetrics')).toHaveLength(
      4
    );
    expect(calls.filter((c) => c === 'cdp:detach')).toHaveLength(1);
    expect(proof.session.wheelSource.target.targetId).toBe('modeled-target');
    for (const entry of proof.ledger.filter((e) => e.action.kind === 'wheel')) {
      expect(entry.wheelDispatch.receipt.observedAt).toBe(
        entry.wheelDispatch.commandReturnedAt + 8
      );
      expect(entry.wheelDispatch.after.before.time).toBeGreaterThanOrEqual(
        entry.wheelDispatch.receipt.observedAt
      );
      expect(entry.wheelDispatch.targetId).toBe('modeled-target');
      expect(entry.wheelDispatch.deltaY).toBe(-560);
      expect(
        entry.wheelDispatch.before.metrics.visualViewport.clientWidth
      ).toBe(2560);
      expect(
        entry.wheelDispatch.after.metrics.cssVisualViewport.clientWidth
      ).toBe(1280);
      expect(entry.wheelDispatch.before.after.time).toBeLessThanOrEqual(
        entry.wheelDispatch.start
      );
      expect(entry.wheelDispatch.after.before.time).toBeGreaterThanOrEqual(
        entry.wheelDispatch.end
      );
    }
  });
  it('retains unavailable CDP evidence while still executing original actions and owned cleanup', async () => {
    const { calls, proof } = await run({ failWheelMetrics: true });
    expect(calls).toContain('latest:1');
    expect(calls.filter((c) => c.startsWith('wheel:'))).toEqual([
      'wheel:0:-100',
      'wheel:0:-560',
      'wheel:0:-560',
    ]);
    expect(calls.filter((c) => c === 'cdp:detach')).toHaveLength(1);
    expect(calls).toContain('fixture-cleanup');
    for (const entry of proof.ledger.filter((e) => e.action.kind === 'wheel')) {
      expect(entry.wheelDispatch.before.error).toContain(
        'owned metrics unavailable'
      );
      expect(entry.wheelDispatch.after.error).toContain(
        'owned metrics unavailable'
      );
    }
  });
  it('dispatches both Latest actions before any bulk export, with unchanged deadlines and block records', async () => {
    const { calls, proof } = await run();
    expect(calls.findIndex((c) => c.startsWith('export:'))).toBeGreaterThan(
      calls.indexOf('latest:1')
    );
    for (const [index, block] of proof.blocks.entries()) {
      expect(block.reading.name).toBe(`reading-${index}`);
      expect(
        block.readingContract.coverage.endTime -
          block.readingContract.terminalTime
      ).toBe(1000);
      const action = proof.ledger.find(
        (entry) =>
          entry.action.kind === 'latest' && entry.action.block === index
      );
      expect(
        action.start - block.readingContract.coverage.endTime
      ).toBeLessThanOrEqual(100);
    }
    expect(proof.blocks[0].semantic.name).toBe('semantic');
    expect(proof.blocks[1].input.name).toBe('input');
    expect(proof.blocks[1].input.samples.at(-1).time).toBe(
      proof.blocks[1].inputEnd
    );
  });
  it('freezes every active collector before exporting and adds no samples at delayed stop', async () => {
    const { calls, captures, proof } = await run();
    const firstExport = calls.findIndex((c) => c.startsWith('export:'));
    for (const entry of captures) {
      expect(calls.indexOf(`freeze:${entry.name}`)).toBeLessThan(firstExport);
      expect(entry.raw.samples).toHaveLength(2);
    }
    expect(calls.indexOf('events-stop')).toBeLessThan(firstExport);
    expect(proof.errors).toEqual([]);
  });
  it('continues every export/disposal and both owned cleanups after a completed READ export fails', async () => {
    const { calls, captures, proof } = await run({ failExport: 'reading-0' });
    expect(calls).toContain('latest:1');
    for (const entry of captures)
      expect(calls).toContain(`dispose:${entry.name}`);
    expect(calls.filter((c) => c === 'presence-cleanup')).toHaveLength(1);
    expect(calls.filter((c) => c === 'fixture-cleanup')).toHaveLength(1);
    expect(calls).toContain('events-dispose');
    expect(
      proof.errors.some((error) => error.includes('export reading-0'))
    ).toBe(true);
    expect(proof.blocks[1].reading.name).toBe('reading-1');
    expect(proof.trace.name).toBe('global');
  });
  it('retains freeze failure and still attempts all partial exports and fixture cleanup', async () => {
    const { calls, proof } = await run({ failFreeze: 'reading-0' });
    expect(calls).toContain('export:reading-0');
    expect(calls).toContain('export:semantic');
    expect(calls).toContain('export:global');
    expect(calls).toContain('events-dispose');
    expect(calls).toContain('presence-cleanup');
    expect(calls).toContain('fixture-cleanup');
    expect(
      proof.errors.some((error) => error.includes('freeze reading-0'))
    ).toBe(true);
  });
});

// Actual installed listener body with only the browser clock/event boundary
// modeled. A command acknowledgement does not synchronously deliver the event.
describe('actual wheel observer receipt lifetime', () => {
  async function observer() {
    const ts = await import('typescript');
    const source = readFileSync(
      resolve(
        import.meta.dirname,
        '../../../apps/tlon-web/e2e/helpers/scrollerSeededSession.ts'
      ),
      'utf8'
    );
    const ast = ts.createSourceFile(
      'helper.ts',
      source,
      ts.ScriptTarget.Latest,
      true
    );
    const fn = ast.statements.find(
      (n) => ts.isFunctionDeclaration(n) && n.name?.text === 'observeActions'
    );
    const js = ts.transpileModule(fn.getText(ast), {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText;
    let clock = 100;
    const listeners = new Map(),
      timers = new Map();
    class Element {}
    class WheelEvent {}
    class KeyboardEvent {}
    class HTMLTextAreaElement {}
    const context = {
      performance: { now: () => clock, timeOrigin: 7 },
      location: {
        pathname: '/apps/groups/group/~zod%2Ftest/channel/chat%2F~zod%2Fsource',
      },
      window: {
        addEventListener(kind, fn, capture) {
          expect(capture).toBe(true);
          listeners.set(kind, fn);
        },
        removeEventListener(kind, fn, capture) {
          expect(capture).toBe(true);
          expect(listeners.get(kind)).toBe(fn);
          listeners.delete(kind);
        },
      },
      setTimeout(fn, delay) {
        const id = {};
        timers.set(id, { fn, at: clock + delay });
        return id;
      },
      clearTimeout(id) {
        timers.delete(id);
      },
      Element,
      WheelEvent,
      KeyboardEvent,
      HTMLTextAreaElement,
      devicePixelRatio: 1,
      innerWidth: 1280,
      innerHeight: 800,
      visualViewport: {
        width: 1280,
        height: 800,
        scale: 1,
        offsetLeft: 0,
        offsetTop: 0,
      },
    };
    context.window.top = context.window;
    const start = new Function(
      ...Object.keys(context),
      `${js};return observeActions;`
    )(...Object.values(context));
    const handle = await start({ evaluateHandle: (fn) => fn() });
    const advance = (time) => {
      clock = time;
      for (const timer of [...timers.values()])
        if (timer.at <= clock) timer.fn();
    };
    const deliver = (time = 110, observedAt = 123, extra = {}) => {
      clock = observedAt;
      listeners.get('wheel')(
        Object.assign(new WheelEvent(), {
          type: 'wheel',
          timeStamp: time,
          target: null,
          isTrusted: true,
          deltaX: 0,
          deltaY: -1120,
          deltaMode: 0,
          ...extra,
        })
      );
    };
    return { handle, advance, deliver, timers, listeners };
  }
  it('waits past native return for the unmodified non-blocking listener', async () => {
    const o = await observer();
    o.advance(115); // Original mouse.wheel return, not a DOM receipt.
    let finished = false;
    const pending = o.handle.waitForWheel(105).then((r) => {
      finished = true;
      return r;
    });
    await Promise.resolve();
    expect(finished).toBe(false);
    o.deliver();
    expect(await pending).toEqual({
      time: 110,
      observedAt: 123,
      timeOrigin: 7,
      scope: '/apps/groups/group/~zod%2Ftest/channel/chat%2F~zod%2Fsource',
    });
    expect(o.timers.size).toBe(0);
    o.handle.stop();
  });
  it('returns an already recorded receipt without waiting for another event', async () => {
    const o = await observer();
    o.deliver();
    o.advance(125);
    expect(await o.handle.waitForWheel(105)).toMatchObject({
      time: 110,
      observedAt: 123,
    });
    expect(o.timers.size).toBe(0);
    o.handle.stop();
  });
  it('does not select past an undesirable first receipt for a matching payload', async () => {
    const o = await observer();
    const pending = o.handle.waitForWheel(105);
    o.deliver(104, 123, { isTrusted: false, deltaY: 1 });
    expect(await pending).toMatchObject({ time: 104, observedAt: 123 });
    o.deliver(125, 126);
    expect(o.handle.stop().events).toHaveLength(2);
  });
  it('ignores prior observations but does not extend the original 250ms deadline', async () => {
    const o = await observer();
    o.deliver(90, 100);
    o.advance(115);
    let finished = false;
    const pending = o.handle.waitForWheel(105).then((r) => {
      finished = true;
      return r;
    });
    o.advance(354);
    await Promise.resolve();
    expect(finished).toBe(false);
    o.advance(355);
    expect(await pending).toEqual({
      error: 'Wheel listener receipt exceeded 250ms',
    });
    expect(o.timers.size).toBe(0);
    o.handle.stop();
  });
  it('cannot certify a late queued receipt', async () => {
    const o = await observer();
    o.deliver(110, 356);
    expect(await o.handle.waitForWheel(105)).toEqual({
      error: 'Wheel listener receipt exceeded 250ms',
    });
    expect(o.timers.size).toBe(0);
    o.handle.stop();
  });
  it('retires a pending receipt and timer when the owned observer stops', async () => {
    const o = await observer();
    const pending = o.handle.waitForWheel(105);
    o.handle.stop();
    expect(await pending).toEqual({ error: 'Wheel observer stopped' });
    expect(o.timers.size).toBe(0);
    expect(o.listeners.size).toBe(0);
  });
});
