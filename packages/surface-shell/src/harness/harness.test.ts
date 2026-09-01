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

/* ------------------------------------------------------------------ */
/* The render context: host-supplied time, and no other kind           */
/* ------------------------------------------------------------------ */

/** Paints the clock reading it was handed, and nothing else. */
function clockApp(api: SurfaceApi) {
  return {
    render(_state: Record<string, unknown>, context: { now: number | null }) {
      return api.html`<div class="app-label">${
        context.now === null ? 'no clock' : String(context.now)
      }</div>`;
    },
  };
}

const FIXED_NOW = Date.UTC(2025, 0, 1, 0, 0, 0);

test('render is handed the host-supplied now as a second argument', () => {
  const { host, shell } = setup();
  shell.api.register(clockApp(shell.api));
  host.send(init({ now: FIXED_NOW }));
  expect(shell.root.textContent).toBe(String(FIXED_NOW));
});

/**
 * The additive half of the contract. An `init` from a host that predates this
 * field must still render, and the app must be able to tell "no clock" from a
 * real reading — not be handed a plausible-looking zero or, worse, a clock the
 * shell went and read for itself.
 */
test('an init with no now leaves context.now null rather than inventing one', () => {
  const { host, shell } = setup();
  shell.api.register(clockApp(shell.api));
  host.send(init());
  expect(shell.root.textContent).toBe('no clock');
});

test('a now message repaints with the new reading', () => {
  const { host, shell } = setup();
  shell.api.register(clockApp(shell.api));
  host.send(init({ now: FIXED_NOW }));
  host.send({ type: 'now', now: FIXED_NOW + 60_000 });
  expect(shell.root.textContent).toBe(String(FIXED_NOW + 60_000));
});

/**
 * The property the whole determinism story rests on: between two `now`
 * messages the shell's clock does not move. If it advanced on its own — a
 * `Date.now()` fallback, an interval that ticked the value forward — a capture
 * harness could inject a fixed `now` and still get different pixels, and every
 * byte-comparison downstream would be comparing two different questions.
 */
test('the shell never advances now on its own', async () => {
  const { host, shell } = setup();
  shell.api.register(clockApp(shell.api));
  host.send(init({ now: FIXED_NOW }));
  const first = shell.root.textContent;
  await new Promise((resolve) => setTimeout(resolve, 50));
  // any repaint at all: a state update, which is the commonest one
  host.send({ type: 'state', state: { label: 'moved' } });
  expect(shell.root.textContent).toBe(first);
});

/**
 * `now` is a DISPLAY input, so it must not be reachable as state. A bundle
 * that read it off `state` would be reading something the reducer folded, and
 * a value the reducer folded is a value a write produced — which is exactly
 * the blur this whole design refuses.
 */
test('now does not leak into the state the app renders from', () => {
  const { host, shell } = setup();
  let seenState: Record<string, unknown> | null = null;
  shell.api.register({
    render(state: Record<string, unknown>) {
      seenState = state;
      return shell.api.html`<div />`;
    },
  });
  host.send(init({ now: FIXED_NOW }));
  expect(seenState).toEqual({ label: 'first' });
});
