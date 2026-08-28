import { beforeEach, expect, test, vi } from 'vitest';

import {
  SHELL_ERROR_TELEMETRY_DETAIL_LIMIT,
  SHELL_ERROR_TELEMETRY_REPORT_LIMIT,
  createSandboxSession,
  sandboxSessionKey,
  shellErrorCategory,
} from './sandboxSession';

// the session's logger is the telemetry boundary under test (F6), so it is
// mocked rather than observed through the real debug store
const mockLogger = vi.hoisted(() => ({
  log: vi.fn(),
  trackError: vi.fn(),
}));

vi.mock('@tloncorp/shared/debug', () => ({
  createDevLogger: () => mockLogger,
}));

beforeEach(() => {
  mockLogger.log.mockClear();
  mockLogger.trackError.mockClear();
});

const SPEC = {
  version: 1 as const,
  surfaceId: 'srf-1',
  specRevision: 7,
  bundle: {
    assetRef: 'https://x/b',
    sha256: 'a'.repeat(64),
    size: 64,
    shellVersion: 1,
  },
  initialState: {},
  actions: { vote: { ops: [] } },
};

function setup(overrides: { canInvoke?: boolean } = {}) {
  const posts: string[] = [];
  const onInvoke = vi.fn();
  const onShellError = vi.fn();
  const session = createSandboxSession({
    spec: SPEC,
    initialState: { votes: {} },
    theme: 'light',
    canInvoke: overrides.canInvoke ?? true,
    post: (serialized) => posts.push(serialized),
    onInvoke,
    onShellError,
  });
  const sent = () => posts.map((raw) => JSON.parse(raw));
  return { session, posts, sent, onInvoke, onShellError };
}

const ready = JSON.stringify({
  type: 'ready',
  shellVersion: 1,
  protocolVersion: 1,
});

const invoke = (actionId: string, specRevision = 7) =>
  JSON.stringify({ type: 'invoke', actionId, specRevision });

const shellError = (phase: string, message: string) =>
  JSON.stringify({ type: 'error', phase, message });

test('ready triggers init with current spec, state, theme, permission', () => {
  const { session, sent } = setup();
  expect(session.isReady()).toBe(false);
  session.handleInbound(ready);
  expect(session.isReady()).toBe(true);
  expect(sent()).toEqual([
    {
      type: 'init',
      protocolVersion: 1,
      spec: SPEC,
      state: { votes: {} },
      theme: 'light',
      canInvoke: true,
    },
  ]);
});

test('updates before ready fold into the eventual init; after ready they post', () => {
  const { session, sent } = setup();
  session.updateState({ votes: { '~zod': 'yes' } });
  session.updateTheme('dark');
  session.updatePermission(false);
  expect(sent()).toEqual([]);

  session.handleInbound(ready);
  expect(sent()).toEqual([
    expect.objectContaining({
      type: 'init',
      state: { votes: { '~zod': 'yes' } },
      theme: 'dark',
      canInvoke: false,
    }),
  ]);

  session.updateState({ votes: {} });
  expect(sent().at(-1)).toEqual({ type: 'state', state: { votes: {} } });
  session.updateTheme('light');
  expect(sent().at(-1)).toEqual({ type: 'theme', theme: 'light' });
  session.updatePermission(true);
  expect(sent().at(-1)).toEqual({ type: 'permission', canInvoke: true });
});

test('a matching-revision invoke passes only the actionId through', () => {
  const { session, onInvoke } = setup();
  session.handleInbound(ready);
  session.handleInbound(
    JSON.stringify({ type: 'invoke', actionId: 'vote', specRevision: 7 })
  );
  expect(onInvoke).toHaveBeenCalledTimes(1);
  expect(onInvoke).toHaveBeenCalledWith('vote');
});

test('stale or future revision invokes are dropped (stale sandbox)', () => {
  const { session, onInvoke } = setup();
  session.handleInbound(ready);
  for (const specRevision of [6, 8, 0]) {
    session.handleInbound(
      JSON.stringify({ type: 'invoke', actionId: 'vote', specRevision })
    );
  }
  expect(onInvoke).not.toHaveBeenCalled();
});

test('an invoke naming an action the spec never declared is dropped', () => {
  const { session, onInvoke } = setup();
  session.handleInbound(ready);
  session.handleInbound(invoke('ghost'));
  // never reaches the writer, so no post is ever constructed or signed
  expect(onInvoke).not.toHaveBeenCalled();
});

test('an inherited name is not resolvable as a declared action', () => {
  const { session, onInvoke } = setup();
  session.handleInbound(ready);
  // schema-valid actionId (lowercase, /^[a-z0-9-]+$/) that a plain
  // `spec.actions[actionId]` lookup would happily resolve off the prototype
  expect((SPEC.actions as Record<string, unknown>).constructor).toBeDefined();
  session.handleInbound(invoke('constructor'));
  expect(onInvoke).not.toHaveBeenCalled();
});

test('invokes are gated on the permission the host currently holds', () => {
  const { session, onInvoke } = setup({ canInvoke: false });
  session.handleInbound(ready);
  session.handleInbound(invoke('vote'));
  expect(onInvoke).not.toHaveBeenCalled();

  // a declared action with permission still passes
  session.updatePermission(true);
  session.handleInbound(invoke('vote'));
  expect(onInvoke).toHaveBeenCalledTimes(1);
  expect(onInvoke).toHaveBeenCalledWith('vote');

  // and it is the CURRENT permission, not the one the session started with
  session.updatePermission(false);
  session.handleInbound(invoke('vote'));
  expect(onInvoke).toHaveBeenCalledTimes(1);
});

test('invalid and widened messages are dropped, never acted on', () => {
  const { session, onInvoke, onShellError } = setup();
  session.handleInbound(ready);
  const invalid = [
    'not json',
    42,
    null,
    JSON.stringify({ type: 'invoke', actionId: 'vote' }),
    JSON.stringify({
      type: 'invoke',
      actionId: 'vote',
      specRevision: 7,
      ops: [{ op: 'set', path: '/pwn', value: 1 }],
    }),
    JSON.stringify({
      type: 'invoke',
      actionId: 'vote',
      specRevision: 7,
      actor: '~bus',
    }),
    JSON.stringify({ type: 'sendMessage', text: 'hi' }),
    JSON.stringify({ type: 'navigate', to: 'settings' }),
    JSON.stringify({ type: 'error', phase: 'render' }),
  ];
  for (const raw of invalid) {
    session.handleInbound(raw);
  }
  expect(onInvoke).not.toHaveBeenCalled();
  expect(onShellError).not.toHaveBeenCalled();
});

test('shell error reports reach the host callback', () => {
  const { session, onShellError } = setup();
  session.handleInbound(
    JSON.stringify({ type: 'error', phase: 'render', message: 'boom' })
  );
  expect(onShellError).toHaveBeenCalledWith('render', 'boom');
});

test('an unrecognized phase telemeters as the enum fallback, not itself', () => {
  for (const phase of ['init', 'render', 'bridge']) {
    expect(shellErrorCategory(phase)).toBe(phase);
  }
  for (const phase of ['', 'constructor', "render ~zod's private board"]) {
    expect(shellErrorCategory(phase)).toBe('unknown');
  }
});

test('telemetry gets a category and a truncated detail; local paths get all of it', () => {
  const { session, onShellError } = setup();
  // the protocol caps the reported message at 1024
  const long = 'secret-'.repeat(146).slice(0, 1024);
  session.handleInbound(shellError('render', long));

  expect(mockLogger.trackError).toHaveBeenCalledTimes(1);
  const reported = mockLogger.trackError.mock.calls[0][1];
  expect(reported.phase).toBe('render');
  expect(reported.detail).toBe(
    long.slice(0, SHELL_ERROR_TELEMETRY_DETAIL_LIMIT)
  );
  expect(reported.detail.length).toBe(SHELL_ERROR_TELEMETRY_DETAIL_LIMIT);
  // nothing sandbox-chosen rides under a key trackError writes itself
  expect(reported).not.toHaveProperty('message');

  // in-process paths are deliberately unbounded
  expect(onShellError).toHaveBeenCalledWith('render', long);
  expect(mockLogger.log).toHaveBeenCalledWith(
    'surface shell reported an error',
    'render',
    long
  );
});

test('shell error telemetry stops at the per-session cap; local paths do not', () => {
  const { session, onShellError } = setup();
  const burst = SHELL_ERROR_TELEMETRY_REPORT_LIMIT + 4;
  for (let i = 0; i < burst; i++) {
    session.handleInbound(shellError('bridge', `boom ${i}`));
  }
  expect(mockLogger.trackError).toHaveBeenCalledTimes(
    SHELL_ERROR_TELEMETRY_REPORT_LIMIT
  );
  expect(onShellError).toHaveBeenCalledTimes(burst);
  expect(
    mockLogger.log.mock.calls.filter(
      ([label]) => label === 'surface shell reported an error'
    )
  ).toHaveLength(burst);

  // the cap belongs to the session, not the module
  const fresh = setup();
  fresh.session.handleInbound(shellError('bridge', 'new session'));
  expect(mockLogger.trackError).toHaveBeenCalledTimes(
    SHELL_ERROR_TELEMETRY_REPORT_LIMIT + 1
  );
});

test('a second ready (iframe reload) re-inits with current values', () => {
  const { session, sent } = setup();
  session.handleInbound(ready);
  session.updateState({ votes: { '~ten': 'no' } });
  session.handleInbound(ready);
  const inits = sent().filter((message) => message.type === 'init');
  expect(inits).toHaveLength(2);
  expect(inits[1].state).toEqual({ votes: { '~ten': 'no' } });
});

test('the session key changes on a revision bump AND on a bundle change', () => {
  const otherBundle = { ...SPEC.bundle, sha256: 'b'.repeat(64) };
  const base = sandboxSessionKey(SPEC);

  expect(sandboxSessionKey({ ...SPEC, specRevision: 8 })).not.toBe(base);
  expect(sandboxSessionKey({ ...SPEC, bundle: otherBundle })).not.toBe(base);
  // same bundle, same revision — the same live session, no remount
  expect(sandboxSessionKey({ ...SPEC })).toBe(base);
});
