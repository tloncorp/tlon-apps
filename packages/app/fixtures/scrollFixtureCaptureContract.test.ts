import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import {
  automatedScrollScenarios,
  declareFixtureSampledRuler,
  selectFixtureSuiteScenarios,
  parseFixtureSuiteRequest,
  parseFixtureCorrectionDiagnostics,
  parseFixtureNativeReadTimingSession,
} from './scrollFixtureCaptureContract';

const owner = {
  scope: 'chat/channel::7',
  rootId: 'root',
  scrollViewId: 'scroll',
  composerId: 'composer',
};
const selected = [
  'history-grow',
  'history-cache',
  'history-remove',
  'append-end',
  'thinking-label-end',
  'thinking-handoff-message-first-end',
];
describe('fixture capture contracts', () => {
  it('native timing is explicitly selected independently of core or standalone scenarios', () => {
    expect(
      parseFixtureNativeReadTimingSession(new URLSearchParams('suite=core'))
    ).toBeUndefined();
    for (const route of ['suite=core', 'scenario=command-center']) {
      expect(
        parseFixtureNativeReadTimingSession(
          new URLSearchParams(`${route}&nativeReadTimingSession=r13.A_1:-`)
        )
      ).toBe('r13.A_1:-');
    }
    expect(
      parseFixtureNativeReadTimingSession(
        new URLSearchParams({ nativeReadTimingSession: 'a'.repeat(128) })
      )
    ).toHaveLength(128);
  });
  it.each(['', 'x'.repeat(129), 'bad/token', 'bad token', 'bad\n', 'é'])(
    'rejects invalid requested native timing session %j',
    (nativeReadTimingSession) => {
      expect(() =>
        parseFixtureNativeReadTimingSession(
          new URLSearchParams({ nativeReadTimingSession })
        )
      ).toThrow();
    }
  );
  it('rejects duplicate timing session parameters', () => {
    expect(() =>
      parseFixtureNativeReadTimingSession(
        new URLSearchParams(
          'nativeReadTimingSession=a&nativeReadTimingSession=a'
        )
      )
    ).toThrow();
  });
  it('keeps dependency diagnostics off unless explicitly requested', () => {
    expect(
      parseFixtureCorrectionDiagnostics(new URLSearchParams('suite=core'))
    ).toBe(false);
    expect(
      parseFixtureCorrectionDiagnostics(
        new URLSearchParams('suite=core&diagnostics=corrections')
      )
    ).toBe(true);
  });
  it.each([
    'diagnostics=corrections',
    'suite=core&diagnostics=',
    'suite=core&diagnostics=all',
    'suite=core&diagnostics=corrections&diagnostics=corrections',
  ])('rejects an invalid diagnostic request: %s', (query) => {
    expect(() =>
      parseFixtureCorrectionDiagnostics(new URLSearchParams(query))
    ).toThrow();
  });
  it('declares the exact intended native owner before ordinary acquisition', () => {
    const declared = declareFixtureSampledRuler('ios', 'history-remove', owner);
    expect(declared).toEqual({
      version: 'indexed-cell-and-surfaces-v2',
      ...owner,
    });
    owner.scope = 'chat/channel::8';
    expect(declared?.scope).toBe('chat/channel::7');
    owner.scope = 'chat/channel::7';
  });
  it.each([
    'entry-latest',
    'entry-selected',
    'entry-delayed',
    'entry-empty',
    'reset',
    'navigation',
    'media-return',
    'unknown',
  ])('does not adopt the single-owner contract for %s', (scenario) => {
    expect(declareFixtureSampledRuler('ios', scenario, owner)).toBeUndefined();
  });
  it.each(['android', 'web'])(
    'keeps %s outside the iOS contract',
    (platform) => {
      expect(
        declareFixtureSampledRuler(platform, 'append-end', owner)
      ).toBeUndefined();
    }
  );
  it.each(['scope', 'rootId', 'scrollViewId', 'composerId'] as const)(
    'refuses a missing expected %s rather than inventing one',
    (field) => {
      expect(() =>
        declareFixtureSampledRuler('ios', 'append-end', {
          ...owner,
          [field]: '',
        })
      ).toThrow();
    }
  );
  it('keeps the complete 38-case default and copies it independently', () => {
    const actual = selectFixtureSuiteScenarios();
    expect(actual).toEqual(automatedScrollScenarios);
    expect(actual).toHaveLength(38);
    expect(actual).not.toBe(automatedScrollScenarios);
  });
  it.each(['command-center', 'command-offscreen'])(
    'permits standalone %s without changing the core registry',
    (scenario) => {
      expect(declareFixtureSampledRuler('ios', scenario, owner)).toEqual({
        version: 'indexed-cell-and-surfaces-v2',
        ...owner,
      });
      expect(() => selectFixtureSuiteScenarios(scenario)).toThrow();
    }
  );
  it('preserves exactly the six requested names and order from a deep link', () => {
    expect(selectFixtureSuiteScenarios(selected.join(','))).toEqual(selected);
  });
  it('snapshots a caller array so later mutation cannot omit a queued case', () => {
    const names = [...selected];
    const declared = selectFixtureSuiteScenarios(names);
    names.pop();
    expect(declared).toEqual(selected);
  });
  it.each(
    [
      '',
      ',',
      'append-end,',
      'unknown',
      'append-end,unknown',
      'append-end,append-end',
      ' append-end',
      [],
      ['append-end', 'append-end'],
    ].map((names) => ({ names }))
  )(
    'rejects malformed/empty/unknown/duplicate selection $names',
    ({ names }) => {
      expect(() => selectFixtureSuiteScenarios(names)).toThrow();
    }
  );
});

describe('suite deep-link dispatch', () => {
  it('preserves the exact requested order through the real suite parser', () => {
    expect(
      parseFixtureSuiteRequest(
        new URLSearchParams({ suite: 'core', scenarios: selected.join(',') })
      )
    ).toEqual(selected);
  });
  it.each([
    'suite=core&scenarios=',
    'suite=unknown',
    'suite=&scenarios=append-end',
    'scenarios=append-end',
    'suite=core&scenarios=append-end,append-end',
    'suite=core&scenarios=append-end&scenarios=unknown',
    'suite=core&suite=unknown',
  ])('rejects %s before dispatch', (query) => {
    expect(() =>
      parseFixtureSuiteRequest(new URLSearchParams(query))
    ).toThrow();
  });
  it('keeps an ordinary single-scenario link out of suite dispatch', () => {
    expect(
      parseFixtureSuiteRequest(
        new URLSearchParams({ scenario: 'history-remove' })
      )
    ).toBeUndefined();
  });
});

// Execute the fixture's recording/action prefix and its actual armed branches.
// Native delivery and user input are controlled here; this is no device proof.
describe('actual armed fixture input readiness', () => {
  const fixture = readFileSync(
    resolve(__dirname, 'ScrollStability.fixture.tsx'),
    'utf8'
  );
  const ast = ts.createSourceFile(
    'fixture.tsx',
    fixture,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const branch = (needle: string) => {
    let result: string | undefined;
    const visit = (node: ts.Node) => {
      if (
        ts.isIfStatement(node) &&
        node.expression.getText(ast).includes(needle)
      )
        result ??= node.getText(ast);
      ts.forEachChild(node, visit);
    };
    visit(ast);
    if (!result) throw new Error(`Actual armed branch missing: ${needle}`);
    return result;
  };
  const compile = (body: string) =>
    new Function(
      ts.transpileModule(body, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2020,
          module: ts.ModuleKind.None,
        },
      }).outputText
    )();
  const start = fixture.indexOf(
    '        if (nativeRecordingContract) {',
    fixture.indexOf('let nativeRecording: unknown')
  );
  const stop = fixture.indexOf('        while (!disposed.current', start);
  if (start < 0 || stop <= start)
    throw new Error('Actual recording/action preparation changed');
  const prepare = compile(`return async function(env) {
    const {scenario, Platform, nativeRecordingModule, action, event, performance} = env;
    const nativeRecordingContract = {recordingId:'recording', request:{}};
    const preparedMutation = undefined, nativeEntryContract = undefined, nativePostGestureProbe = undefined;
    let nativeRecordingOwned = false, nativeStartAcknowledgedAt = 0, nativeEarliestStopAt = 0;
    let nativeRecording, actionError, completedAt, actionCompleted = false;
    const duration = 4500, assertion = 'gesture';
    ${fixture.slice(start, stop)}
    await actionDone;
    return {actionError, actionCompleted, nativeRecordingOwned};
  };`);
  const choose = compile(`return async function(env) {
    const {name, event, waitUntil, events, transitionThinking, pause, setStatus, position,
      prepareGatedImage, releaseGatedImage, capture, performance} = env;
    ${branch('^armed-thinking-')}
    ${branch('^armed-image-load-')}
    throw new Error('Unknown armed branch');
  };`);
  const preparePost = compile(`return async function(env) {
    const {name, thinkingEvidence, transitionThinking, waitUntil, position, capture, pause} = env;
    ${branch('^armed-post-gesture-thinking-')}
    throw new Error('Unknown post-gesture branch');
  };`);
  it.each([
    ['end', false],
    ['away', false],
    ['end', true],
    ['away', true],
  ])(
    'prepares %s from an already committed thinking state (visible=%s)',
    async (outcome, visible) => {
      const thinkingEvidence = {
        current: {
          visible,
          height: visible ? 52 : 0,
          committedAt: 10,
          laidOutAt: 10,
        },
      };
      const labels: (string | undefined)[] = [];
      const capture = vi.fn((_name, _assertion, action, duration) => {
        expect(thinkingEvidence.current.visible).toBe(false);
        expect(duration).toBe(4500);
        return action;
      });
      const action = await preparePost({
        name: `armed-post-gesture-thinking-${outcome}`,
        thinkingEvidence,
        transitionThinking: async (label?: string) => {
          const next = label !== undefined;
          // React does not emit a fresh layout/commit for the same hidden state.
          if (thinkingEvidence.current.visible === next)
            throw Error('No new thinking commit for unchanged state');
          labels.push(label);
          Object.assign(thinkingEvidence.current, {
            visible: next,
            height: next ? 52 : 0,
            committedAt: 20,
            laidOutAt: 20,
          });
        },
        waitUntil: async (check: () => boolean) => {
          if (!check()) throw Error('Missing actual hidden baseline');
        },
        position: async () => {},
        pause: async () => {},
        capture,
      });
      expect(capture).toHaveBeenCalledOnce();
      await action();
      expect(labels).toEqual(
        visible
          ? [undefined, 'Thinking...', undefined]
          : ['Thinking...', undefined]
      );
    }
  );
  it('does not prepare a post-gesture capture from default unmeasured thinking values', async () => {
    const capture = vi.fn();
    await expect(
      preparePost({
        name: 'armed-post-gesture-thinking-end',
        thinkingEvidence: {
          current: { visible: false, height: 0, committedAt: 0, laidOutAt: 0 },
        },
        transitionThinking: vi.fn(),
        waitUntil: async (check: () => boolean) => {
          if (!check()) throw Error('Missing actual hidden baseline');
        },
        position: vi.fn(),
        capture,
      })
    ).rejects.toThrow('Missing actual hidden baseline');
    expect(capture).not.toHaveBeenCalled();
  });
  let postBranch: string | undefined;
  const findPostBranch = (node: ts.Node) => {
    if (
      ts.isIfStatement(node) &&
      node.expression.getText(ast) === 'nativePostGestureProbe' &&
      node.getText(ast).includes('const listOwner =')
    )
      postBranch = node.getText(ast);
    ts.forEachChild(node, findPostBranch);
  };
  findPostBranch(ast);
  const postAction = compile(`return async function(env) {
    const {nativePostGestureProbe, list, commands, attachedChannel, generationRef, performance,
      event, setStatus, scenario, events, waitUntil, snapshot, nativeSampledRulerContract,
      chooseReadingAnchor, requiredRows, deadline, nativeRecordingModule, action} = env;
    ${postBranch ?? 'throw new Error("Missing actual post-gesture action")'}
  };`);
  function postSetup(change: (env: any) => void = () => {}) {
    let time = 0;
    const order: string[] = [];
    const probe: any = {
      contract: { recordingId: 'recording', probeId: 'probe', outcome: 'end' },
      markerTransfers: [],
    };
    const events: any = { current: [] };
    const env: any = {
      nativePostGestureProbe: probe,
      list: { current: {} },
      commands: { current: { captureScrollIntent: () => () => true } },
      attachedChannel: { current: 'channel' },
      generationRef: { current: 7 },
      performance: { now: () => ++time },
      event: (name: string, values: unknown) =>
        events.current.push({ name, values, time: ++time }),
      scenario: 'armed-post-gesture-thinking-end',
      events,
      deadline: 4500,
      nativeSampledRulerContract: { scope: 'channel::7' },
      setStatus: () => {
        order.push('armed');
        env.event('drag-begin');
        env.event('drag-end');
      },
      waitUntil: async (
        check: () => boolean,
        _message: string,
        limit: number
      ) => {
        expect(limit).toBe(2800);
        if (!check()) throw Error('no completion');
      },
      snapshot: async () => {
        order.push('baseline');
        return {
          measurement: { valid: true, durationMs: 1 },
          scrollBounds: { min: 0, max: 1000 },
          scroll: 1000,
          acquisition: {
            nativeGeometry: {
              capture: {
                scroll: {
                  tracking: false,
                  dragging: false,
                  decelerating: false,
                },
              },
            },
          },
        };
      },
      chooseReadingAnchor: () => ({ key: 'reading' }),
      requiredRows: { current: new Set() },
      nativeRecordingModule: {
        markScrollGeometryRecording: async (
          recordingId: string,
          name: string
        ) => {
          order.push(name);
          return { status: 'ok', recordingId, marker: { name } };
        },
      },
      action: async () => {
        order.push('thinking-show-hide');
      },
    };
    change(env);
    return { env, probe, order };
  }
  it('pins the actual settled snapshot before native probe marker and thinking mutation', async () => {
    const x = postSetup();
    await postAction(x.env);
    expect(x.order).toEqual([
      'armed',
      'baseline',
      'probe:start',
      'thinking-show-hide',
      'probe:hidden',
    ]);
    expect(x.probe.baseline).toBeDefined();
    expect(x.probe.completion.name).toBe('drag-end');
  });
  it('pins the exposed away anchor before the post-completion mutation', async () => {
    const x = postSetup((env) => {
      env.nativePostGestureProbe.contract.outcome = 'away';
      const capture = env.snapshot;
      env.snapshot = async () => ({ ...(await capture()), scroll: 950 });
    });
    await postAction(x.env);
    expect(x.probe.anchorKey).toBe('reading');
    expect(x.env.requiredRows.current.has('reading')).toBe(true);
    expect(x.order.indexOf('baseline')).toBeLessThan(
      x.order.indexOf('thinking-show-hide')
    );
  });
  it('accepts the actual matching momentum completion before the baseline', async () => {
    const x = postSetup((env) => {
      env.setStatus = () => {
        env.event('drag-begin');
        env.event('drag-end');
        env.event('momentum-begin');
        env.event('momentum-end');
      };
    });
    await postAction(x.env);
    expect(x.probe.completion.name).toBe('momentum-end');
  });
  it.each(['tracking', 'dragging', 'decelerating'])(
    'does not mutate after a native %s baseline',
    async (flag) => {
      const x = postSetup((env) => {
        env.snapshot = async () => ({
          measurement: { valid: true, durationMs: 1 },
          acquisition: {
            nativeGeometry: { capture: { scroll: { [flag]: true } } },
          },
        });
      });
      await expect(postAction(x.env)).rejects.toThrow(
        'stationary native owner'
      );
      expect(x.order).toEqual(['armed']);
    }
  );
  it('rejects a newer native-owner scope while the baseline promise is pending', async () => {
    const x = postSetup((env) => {
      const capture = env.snapshot;
      env.snapshot = async () => {
        env.generationRef.current++;
        return capture();
      };
    });
    await expect(postAction(x.env)).rejects.toThrow('stationary native owner');
    expect(x.order).not.toContain('thinking-show-hide');
  });
  it('requires the real momentum end when momentum began', async () => {
    const x = postSetup((env) => {
      env.setStatus = () => {
        env.event('drag-begin');
        env.event('drag-end');
        env.event('momentum-begin');
      };
    });
    await expect(postAction(x.env)).rejects.toThrow('no completion');
    expect(x.order).not.toContain('thinking-show-hide');
  });
  it('rejects a newer command intent during the pending baseline query', async () => {
    const x = postSetup((env) => {
      let current = true;
      env.commands.current.captureScrollIntent = () => () => current;
      const capture = env.snapshot;
      env.snapshot = async () => {
        current = false;
        return capture();
      };
    });
    await expect(postAction(x.env)).rejects.toThrow('stationary native owner');
    expect(x.order).not.toContain('thinking-show-hide');
  });
  it('rejects a mismatched endpoint before native marker or thinking mutation', async () => {
    const x = postSetup((env) => {
      env.nativePostGestureProbe.contract.outcome = 'away';
    });
    await expect(postAction(x.env)).rejects.toThrow('endpoint differs');
    expect(x.order).not.toContain('thinking-show-hide');
  });
  it('does not extend the recording when the gesture settles too late', async () => {
    const x = postSetup((env) => {
      env.deadline = 1000;
    });
    await expect(postAction(x.env)).rejects.toThrow('quiet tail');
    expect(x.order).not.toContain('thinking-show-hide');
  });
  function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((done) => {
      resolve = done;
    });
    return { promise, resolve };
  }
  const flush = async () => {
    for (let i = 0; i < 12; i++) await Promise.resolve();
  };
  async function setup(name = 'armed-thinking-keyboard-end') {
    let time = 0,
      actions = 0;
    const performance = { now: () => ++time };
    const events = {
      current: [] as { name: string; time: number; values?: unknown }[],
    };
    const statuses: string[] = [];
    const event = (name: string, values?: unknown) =>
      events.current.push({ name, time: ++time, values });
    const start = deferred<unknown>(),
      marker = deferred<unknown>();
    const starts = vi.fn(() => start.promise),
      marks = vi.fn(() => marker.promise);
    const action = await choose({
      name,
      events,
      event,
      performance,
      position: async () => {},
      capture: (
        _name: string,
        _assertion: string,
        action: () => Promise<void>
      ) => action,
      prepareGatedImage: async () => ({
        key: 'image',
        src: 'http://gate/image',
        token: 'gate',
      }),
      releaseGatedImage: async () => {
        event('release');
      },
      transitionThinking: async () => {
        event('thinking');
      },
      pause: async () => {},
      setStatus: (value: string) => {
        statuses.push(value);
        if (value === `Armed ${name}`)
          event(
            name.includes('-keyboard-')
              ? 'keyboardWillShow'
              : name.includes('-composer-')
                ? 'composer-input'
                : 'drag-begin'
          );
      },
      waitUntil: async (
        predicate: () => boolean,
        _message: string,
        timeout: number
      ) => {
        expect(timeout).toBe(2800);
        if (!predicate())
          throw new Error(
            'No input delivered after an observable armed status'
          );
      },
    });
    const result = prepare({
      scenario: name,
      Platform: { OS: 'ios' },
      performance,
      event,
      nativeRecordingModule: {
        startScrollGeometryRecording: starts,
        markScrollGeometryRecording: marks,
      },
      action: async () => {
        actions++;
        await action();
      },
    });
    return {
      start,
      marker,
      starts,
      marks,
      statuses,
      events,
      result,
      actions: () => actions,
    };
  }
  const markerAck = {
    status: 'ok',
    recordingId: 'recording',
    marker: { name: 'action-start' },
  };
  it.each([
    'armed-thinking-keyboard-end',
    'armed-thinking-gesture',
    'armed-image-load-keyboard-history',
    'armed-image-load-composer-end',
    'armed-image-load-gesture',
  ])(
    'arms %s only after both acknowledgements and accepts input immediately on publication',
    async (name) => {
      const x = await setup(name);
      await flush();
      expect(x.actions()).toBe(0);
      expect(x.statuses).toEqual([]);
      expect(x.marks).not.toHaveBeenCalled();
      x.start.resolve({ status: 'ok', recordingId: 'recording' });
      await flush();
      expect(x.actions()).toBe(0);
      expect(x.statuses).toEqual([]);
      expect(x.marks).toHaveBeenCalledWith('recording', 'action-start');
      x.marker.resolve(markerAck);
      const result = await x.result;
      expect(result.actionError).toBeUndefined();
      expect(result.actionCompleted).toBe(true);
      expect(x.statuses).toEqual([`Armed ${name}`]);
      expect(x.actions()).toBe(1);
      const armed = x.events.current.findIndex((e) =>
        /-race-armed$/.test(e.name)
      );
      const input = x.events.current.findIndex((e) =>
        /^(keyboardWillShow|composer-input|drag-begin)$/.test(e.name)
      );
      expect(armed).toBeGreaterThanOrEqual(0);
      expect(input).toBeGreaterThan(armed);
    }
  );
  it.each([{ status: 'unavailable' }, { status: 'ok', recordingId: 'other' }])(
    'never runs an armed action after refused/foreign recording acknowledgement %j',
    async (ack) => {
      const x = await setup();
      x.marker.resolve(markerAck);
      x.start.resolve(ack);
      const result = await x.result;
      expect(result.actionError).toBeDefined();
      expect(x.actions()).toBe(0);
      expect(x.statuses).toEqual([]);
      expect(x.marks).not.toHaveBeenCalled();
    }
  );
  it.each([
    { status: 'unavailable' },
    { status: 'ok', recordingId: 'other', marker: { name: 'action-start' } },
    { status: 'ok', recordingId: 'recording', marker: { name: 'foreign' } },
  ])(
    'never runs an armed action after refused/foreign marker %j',
    async (ack) => {
      const x = await setup();
      x.start.resolve({ status: 'ok', recordingId: 'recording' });
      x.marker.resolve(ack);
      const result = await x.result;
      expect(result.actionError).toBeDefined();
      expect(x.actions()).toBe(0);
      expect(x.statuses).toEqual([]);
    }
  );
  it('retains ordinary non-armed action behavior when native recording is unavailable', async () => {
    const action = vi.fn();
    const result = await prepare({
      scenario: 'append-end',
      Platform: { OS: 'ios' },
      performance: { now: () => 1 },
      event: () => {},
      action,
      nativeRecordingModule: {
        startScrollGeometryRecording: async () => ({ status: 'unavailable' }),
      },
    });
    expect(action).toHaveBeenCalledOnce();
    expect(result.actionError).toBeUndefined();
  });
});
