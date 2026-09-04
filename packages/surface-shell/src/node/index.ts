import { SurfaceApi, createSurfaceShell } from '../harness/index';
import { BridgeTransport } from '../harness/transport';
import {
  JsonObject,
  ShellErrorMessage,
  ShellInvokeMessage,
  ShellSurfaceSpec,
  ShellTheme,
  ShellToHostMessage,
} from '../protocol/types';

/**
 * Node-importable shell runner for smoke renders and fixture tests: drive
 * any bundle + spec + state through the REAL harness with a stubbed
 * bridge host. tlon-skill's publish gate consumes this so its smoke render
 * uses the actual shell, not an approximation (plan §9); the in-repo
 * fixture tests are the same runner with local fixtures.
 *
 * The DOM window is injected (happy-dom in tests and tooling) so this
 * package keeps its runtime dependency set at exactly the vendored three.
 */

export interface ShellFixtureRun {
  root: HTMLElement;
  api: SurfaceApi;
  /** every message the shell sent to the "host", in order */
  messages: ShellToHostMessage[];
  errors(): ShellErrorMessage[];
  invokes(): ShellInvokeMessage[];
  html(): string;
  sendState(state: JsonObject): void;
  setPermission(canInvoke: boolean): void;
  setTheme(theme: ShellTheme): void;
  /** deliver a new host-supplied timestamp and repaint */
  sendNow(now: number): void;
  /** dispatch a click on the first element matching the selector */
  click(selector: string): boolean;
}

export function runShellFixture(options: {
  /** a DOM window (e.g. `new Window()` from happy-dom) */
  window: Window;
  /** the app bundle source; sees the shell's `surface` global */
  bundleSource: string;
  spec: ShellSurfaceSpec;
  state: JsonObject;
  theme?: ShellTheme;
  canInvoke?: boolean;
  /**
   * The host-supplied timestamp for the initial render. Omit for `null` —
   * which is what a caller that has nothing to say about time should do,
   * rather than reaching for the wall clock and making its own output
   * irreproducible.
   */
  now?: number;
  /** optional vendored Chart constructor to expose as surface.Chart */
  chart?: unknown;
}): ShellFixtureRun {
  const win = options.window;
  const messages: ShellToHostMessage[] = [];
  let deliver: (data: unknown) => void = () => {};
  const transport: BridgeTransport = {
    post(message) {
      messages.push(message);
    },
    onMessage(listener) {
      deliver = listener;
    },
  };

  const { api, root } = createSurfaceShell({
    window: win,
    transport,
    chart: options.chart,
  });

  // Evaluate the bundle the way the sandbox document would: a plain
  // script with the shell's global already present. The bundle may also
  // reach `surface` via the provided parameter for explicitness.
  const evaluate = new Function(
    'window',
    'document',
    'globalThis',
    'surface',
    options.bundleSource
  );
  evaluate(win, win.document, win, api);

  deliver({
    type: 'init',
    protocolVersion: 1,
    spec: options.spec,
    state: options.state,
    theme: options.theme ?? 'light',
    canInvoke: options.canInvoke ?? true,
    ...(options.now === undefined ? {} : { now: options.now }),
  });

  return {
    root,
    api,
    messages,
    errors() {
      return messages.filter(
        (message): message is ShellErrorMessage => message.type === 'error'
      );
    },
    invokes() {
      return messages.filter(
        (message): message is ShellInvokeMessage => message.type === 'invoke'
      );
    },
    html() {
      return root.innerHTML;
    },
    sendState(state) {
      deliver({ type: 'state', state });
    },
    setPermission(canInvoke) {
      deliver({ type: 'permission', canInvoke });
    },
    setTheme(theme) {
      deliver({ type: 'theme', theme });
    },
    sendNow(now) {
      deliver({ type: 'now', now });
    },
    click(selector) {
      const el = root.querySelector(selector) as HTMLElement | null;
      if (el === null) {
        return false;
      }
      el.click();
      return true;
    },
  };
}
