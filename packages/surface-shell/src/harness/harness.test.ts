import { expect, test } from 'vitest';

import { ShellToHostMessage } from '../protocol/types';
import { BridgeTransport } from './transport';
import { SurfaceApi, createSurfaceShell } from './index';

/**
 * Stubbed bridge host: capture shell→host messages, push host→shell
 * messages by hand.
 */
function stubHost() {
  const sent: ShellToHostMessage[] = [];
  let deliver: (data: unknown) => void = () => {};
  const transport: BridgeTransport = {
    post(message) {
      sent.push(message);
    },
    onMessage(listener) {
      deliver = listener;
    },
  };
  return {
    transport,
    sent,
    send(data: unknown) {
      deliver(data);
    },
  };
}

const SPEC = {
  surfaceId: 'srf-1',
  specRevision: 7,
  title: 'Poll',
  actions: { vote: { ops: [] }, reset: { ops: [] } },
};

function init(overrides: Record<string, unknown> = {}) {
  return {
    type: 'init',
    protocolVersion: 1,
    spec: SPEC,
    state: { label: 'first' },
    theme: 'dark',
    canInvoke: true,
    ...overrides,
  };
}

function counterApp(api: SurfaceApi) {
  return {
    render(state: Record<string, unknown>) {
      return api.html`<div class="app-label">${String(state.label)}</div>`;
    },
  };
}

function setup() {
  const host = stubHost();
  const shell = createSurfaceShell({ window, transport: host.transport });
  return { host, shell };
}

test('posts ready with shell and protocol versions on startup', () => {
  const { host } = setup();
  expect(host.sent[0]).toEqual({
    type: 'ready',
    shellVersion: 1,
    protocolVersion: 1,
  });
});

test('renders on init, re-renders on state updates', () => {
  const { host, shell } = setup();
  shell.api.register(counterApp(shell.api));
  host.send(init());
  expect(shell.root.textContent).toBe('first');
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

  host.send({ type: 'state', state: { label: 'second' } });
  expect(shell.root.textContent).toBe('second');
});

test('registration after init renders immediately (order-tolerant)', () => {
  const { host, shell } = setup();
  host.send(init());
  expect(shell.root.textContent).toBe('');
  shell.api.register(counterApp(shell.api));
  expect(shell.root.textContent).toBe('first');
});

test('theme messages retarget the token scope', () => {
  const { host } = setup();
  host.send(init({ theme: 'light' }));
  expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  host.send({ type: 'theme', theme: 'dark' });
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
});

test('invoke posts declared actions tagged with the rendered revision', () => {
  const { host, shell } = setup();
  host.send(init());
  expect(shell.api.invoke('vote')).toBe(true);
  expect(host.sent.at(-1)).toEqual({
    type: 'invoke',
    actionId: 'vote',
    specRevision: 7,
  });
});

test('invoke refuses undeclared, malformed, and inherited action ids', () => {
  const { host, shell } = setup();
  host.send(init());
  const before = host.sent.length;
  expect(shell.api.invoke('not-declared')).toBe(false);
  expect(shell.api.invoke('Bad Id!')).toBe(false);
  expect(shell.api.invoke('a'.repeat(65))).toBe(false);
  expect(shell.api.invoke('toString')).toBe(false);
  expect(shell.api.invoke('constructor')).toBe(false);
  expect(host.sent.length).toBe(before);
});

test('permission gates invoke and is live', () => {
  const { host, shell } = setup();
  host.send(init({ canInvoke: false }));
  expect(shell.api.canInvoke()).toBe(false);
  expect(shell.api.invoke('vote')).toBe(false);
  host.send({ type: 'permission', canInvoke: true });
  expect(shell.api.invoke('vote')).toBe(true);
  host.send({ type: 'permission', canInvoke: false });
  expect(shell.api.invoke('vote')).toBe(false);
});

test('a throwing render shows the broken state and reports once per streak', () => {
  const { host, shell } = setup();
  let shouldThrow = true;
  shell.api.register({
    render(state: Record<string, unknown>) {
      if (shouldThrow) {
        throw new Error('render exploded');
      }
      return shell.api.html`<div>${String(state.label)}</div>`;
    },
  });
  host.send(init());
  expect(shell.root.querySelector('.tsh-broken')).toBeTruthy();
  expect(shell.root.textContent).toContain('This app hit an error');
  const errors = host.sent.filter((message) => message.type === 'error');
  expect(errors).toHaveLength(1);
  expect(errors[0]).toMatchObject({
    phase: 'render',
    message: expect.stringContaining('render exploded'),
  });

  // still failing: no repeat report within the same streak
  host.send({ type: 'state', state: { label: 'again' } });
  expect(host.sent.filter((message) => message.type === 'error')).toHaveLength(
    1
  );

  // recovery: renders normally again
  shouldThrow = false;
  host.send({ type: 'state', state: { label: 'recovered' } });
  expect(shell.root.querySelector('.tsh-broken')).toBeNull();
  expect(shell.root.textContent).toBe('recovered');
});

test('error messages over the bridge are length-bounded', () => {
  const { host, shell } = setup();
  shell.api.register({
    render() {
      throw new Error('x'.repeat(5000));
    },
  });
  host.send(init());
  const error = host.sent.find((message) => message.type === 'error');
  expect(error).toBeTruthy();
  expect((error as { message: string }).message.length).toBeLessThanOrEqual(
    1024
  );
});

test('invalid host messages are reported, never thrown', () => {
  const { host, shell } = setup();
  shell.api.register(counterApp(shell.api));
  host.send({ type: 'init' }); // malformed
  host.send('garbage');
  host.send({ type: 'sneaky', payload: 1 });
  const errors = host.sent.filter((message) => message.type === 'error');
  expect(errors.length).toBe(3);
  expect(errors.every((e) => (e as { phase: string }).phase === 'bridge')).toBe(
    true
  );
  // and a good init still works afterwards
  host.send(init());
  expect(shell.root.textContent).toBe('first');
});

test('register rejects shapes without a render function', () => {
  const { host, shell } = setup();
  shell.api.register(null as never);
  shell.api.register({} as never);
  const errors = host.sent.filter((message) => message.type === 'error');
  expect(errors.length).toBe(2);
  expect(errors.every((e) => (e as { phase: string }).phase === 'init')).toBe(
    true
  );
});

test('the api is exposed as globalThis.surface for bundles', () => {
  const { shell } = setup();
  expect((window as Window & { surface?: SurfaceApi }).surface).toBe(shell.api);
});
