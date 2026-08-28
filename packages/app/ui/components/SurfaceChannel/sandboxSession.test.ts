import { expect, test, vi } from 'vitest';

import { createSandboxSession, sandboxSessionKey } from './sandboxSession';

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
