import htm from 'htm';
import { ComponentChild, h, render } from 'preact';

import {
  BrokenState,
  PrimitiveKit,
  createPrimitiveKit,
} from '../primitives/index';
import { isHostToShellMessage } from '../protocol/guards';
import {
  ACTION_ID_MAX_LENGTH,
  ACTION_ID_PATTERN,
  ERROR_MESSAGE_MAX_LENGTH,
  HostInitMessage,
  Json,
  JsonObject,
  PROTOCOL_VERSION,
  ShellSurfaceSpec,
  ShellToHostMessage,
  SurfaceRenderContext,
} from '../protocol/types';
import { SHELL_VERSION } from '../version';
import { BridgeTransport, detectTransport } from './transport';

/**
 * The `render(state)` harness (plan §5): one paradigm, enforced. The app
 * bundle registers a pure render function; the harness calls it on init
 * and on every state update, and wires `invoke(actionId)` to the bridge.
 * App code's entire capability surface is that registration API — it never
 * touches the transport, the DOM root, or the host.
 *
 * Entry-point binding (D-logged, templates inherit this): the shell loads
 * FIRST in the sandbox document and exposes `globalThis.surface`; the app
 * bundle is a plain script that calls `surface.register({ render })`.
 * Registration is order-tolerant — if init arrived before the bundle ran,
 * registering renders immediately.
 */

export interface SurfaceApp {
  /**
   * Pure view of the reduced state; must not keep its own app state.
   *
   * `context` is the second, DISPLAY-ONLY input: `context.now` is the
   * timestamp the host supplied, or null when it supplied none. It is passed
   * on every render and is not part of state — nothing an app derives from it
   * can ever be written back, because writes go through `invoke` and an
   * action's ops are fixed in the spec.
   */
  render(state: JsonObject, context: SurfaceRenderContext): ComponentChild;
}

export interface SurfaceApi {
  /** htm bound to preact's h — apps write `surface.html\`...\`` */
  html: (strings: TemplateStringsArray, ...values: unknown[]) => ComponentChild;
  h: typeof h;
  /**
   * The visual kit, including the `Chart` primitive bound to this shell's
   * Chart.js constructor. Charting goes through `primitives.Chart` —
   * pass it data and options and it owns the container, the canvas node
   * and the instance lifecycle.
   */
  primitives: PrimitiveKit;
  /**
   * The raw vendored Chart.js constructor, when the environment ships it
   * (the artifact does; harness unit tests run chart-free). Kept as the
   * low-level escape hatch for chart work the primitive cannot express;
   * app bundles should reach for `primitives.Chart` instead, which is the
   * only path that gets container sizing right on a phone.
   */
  Chart?: unknown;
  register(app: SurfaceApp): void;
  invoke(actionId: string): boolean;
  canInvoke(): boolean;
}

export interface SurfaceShellHandle {
  api: SurfaceApi;
  root: HTMLElement;
}

function truncate(value: unknown): string {
  const text =
    value instanceof Error
      ? `${value.name}: ${value.message}`
      : typeof value === 'string'
        ? value
        : String(value);
  return text.slice(0, ERROR_MESSAGE_MAX_LENGTH);
}

export function createSurfaceShell(options: {
  window: Window;
  transport?: BridgeTransport;
  root?: HTMLElement;
  /** vendored Chart.js constructor, injected by the artifact entry */
  chart?: unknown;
}): SurfaceShellHandle {
  const win = options.window;
  const doc = win.document;
  const transport = options.transport ?? detectTransport(win);

  const root = options.root ?? doc.createElement('div');
  root.classList.add('tsh-root');
  if (root.parentNode == null) {
    doc.body.appendChild(root);
  }

  let app: SurfaceApp | null = null;
  let spec: ShellSurfaceSpec | null = null;
  let state: JsonObject | null = null;
  let canInvoke = false;
  /**
   * The last timestamp the HOST supplied, and the only time value that
   * exists in here. Nothing in this module reads a clock: there is no
   * `Date.now()` fallback and no timer that advances this on its own, which
   * is exactly what makes a render reproducible under an injected `now`.
   */
  let hostNow: number | null = null;
  let initialized = false;
  // edge-triggered error reporting: one report per failure streak
  let lastRenderFailed = false;

  function post(message: ShellToHostMessage) {
    try {
      transport.post(message);
    } catch {
      // a broken transport must never take the harness down
    }
  }

  function reportError(phase: 'init' | 'render' | 'bridge', error: unknown) {
    post({ type: 'error', phase, message: truncate(error) });
  }

  function renderNow() {
    if (!initialized || app === null || state === null) {
      return;
    }
    try {
      // A fresh context object per render, so a bundle that stashed one
      // cannot watch `now` change behind its own back — the value it was
      // handed is the value that render was for.
      const tree = app.render(state, { now: hostNow });
      render(tree, root);
      lastRenderFailed = false;
    } catch (error) {
      // the defined broken-state view — never a white screen, never a
      // harness crash (plan §9)
      try {
        render(h(BrokenState, { detail: truncate(error) }), root);
      } catch {
        root.textContent = 'This app hit an error';
      }
      if (!lastRenderFailed) {
        reportError('render', error);
      }
      lastRenderFailed = true;
    }
  }

  function applyTheme(theme: 'light' | 'dark') {
    doc.documentElement.setAttribute('data-theme', theme);
  }

  function handleInit(message: HostInitMessage) {
    spec = message.spec;
    state = message.state;
    canInvoke = message.canInvoke;
    hostNow = message.now === undefined ? null : message.now;
    initialized = true;
    applyTheme(message.theme);
    renderNow();
  }

  transport.onMessage((data) => {
    if (!isHostToShellMessage(data)) {
      reportError('bridge', 'invalid host message');
      return;
    }
    switch (data.type) {
      case 'init':
        handleInit(data);
        break;
      case 'state':
        state = data.state;
        renderNow();
        break;
      case 'theme':
        applyTheme(data.theme);
        break;
      case 'permission':
        canInvoke = data.canInvoke;
        renderNow();
        break;
      case 'now':
        // The host decides the cadence — on an interval for a spec that
        // declares `timeDisplay`, never for one that does not. The shell just
        // takes what it is given and repaints.
        hostNow = data.now;
        renderNow();
        break;
    }
  });

  const html = htm.bind(h) as SurfaceApi['html'];

  const api: SurfaceApi = {
    html,
    h,
    primitives: createPrimitiveKit(options.chart),
    Chart: options.chart,
    register(nextApp: SurfaceApp) {
      if (
        typeof nextApp !== 'object' ||
        nextApp === null ||
        typeof nextApp.render !== 'function'
      ) {
        reportError('init', 'register() requires an object with render()');
        return;
      }
      app = nextApp;
      lastRenderFailed = false;
      renderNow();
    },
    invoke(actionId: string): boolean {
      if (!canInvoke) {
        return false;
      }
      if (
        typeof actionId !== 'string' ||
        actionId.length === 0 ||
        actionId.length > ACTION_ID_MAX_LENGTH ||
        !ACTION_ID_PATTERN.test(actionId)
      ) {
        return false;
      }
      // only declared actions leave the sandbox (own-property: inherited
      // names must not resolve)
      if (
        spec === null ||
        !Object.prototype.hasOwnProperty.call(spec.actions, actionId)
      ) {
        return false;
      }
      post({
        type: 'invoke',
        actionId,
        specRevision: spec.specRevision,
      });
      return true;
    },
    canInvoke() {
      return canInvoke;
    },
  };

  (win as Window & { surface?: SurfaceApi }).surface = api;

  post({
    type: 'ready',
    shellVersion: SHELL_VERSION,
    protocolVersion: PROTOCOL_VERSION,
  });

  return { api, root };
}

export type { BridgeTransport } from './transport';
export type { Json, JsonObject };
