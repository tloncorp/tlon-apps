import {
  type JsonObject,
  type SurfaceSpec,
  getDeclaredAction,
} from '@tloncorp/api';
// the /debug subpath keeps this module (and its vitest suite) off the
// shared barrel, which drags expo-modules-core into node tests
import { createDevLogger } from '@tloncorp/shared/debug';
import { ShellToHostMessageSchema } from '@tloncorp/surface-shell/protocol';

const logger = createDevLogger('surfaceSandboxSession', false);

/**
 * Platform-agnostic sandbox message discipline, shared by the iframe and
 * WebView hosts:
 *
 * - EVERY inbound message validates against the shell's canonical zod
 *   schemas (strict — an invoke with smuggled fields is rejected, not
 *   stripped) before anything acts on it.
 * - The host trusts its own state, not the message: an invoke's
 *   `specRevision` is cross-checked against the spec this session
 *   initialized the sandbox with; a mismatch means a stale sandbox and the
 *   invoke is dropped and logged. The caller stamps its own revision when
 *   constructing the event.
 * - The host also trusts its own PERMISSION and its own SPEC: an invoke is
 *   dropped unless this session currently holds write permission and the
 *   actionId is an own property of the initialized spec's actions. The
 *   shell disables controls for both cases, but a bundle can post the
 *   message directly, so neither is enforced by the sandbox's chrome.
 * - Outbound messages are JSON strings (the shell parses both, but
 *   strings survive every transport identically).
 */

/**
 * At most this many shell errors per session reach telemetry. A looping
 * bundle can emit `error` as fast as it likes; after the cap the session
 * keeps logging locally and keeps calling `onShellError`, but stops
 * spending network on a fault that has already been reported.
 */
export const SHELL_ERROR_TELEMETRY_REPORT_LIMIT = 5;

const SHELL_ERROR_CATEGORIES = ['init', 'render', 'bridge'] as const;

export type ShellErrorCategory =
  | (typeof SHELL_ERROR_CATEGORIES)[number]
  | 'unknown';

/**
 * Map a reported phase onto a fixed enum before it can reach telemetry.
 *
 * The protocol schema already narrows `phase` to these three literals, so
 * in the current wiring `'unknown'` is unreachable from `handleInbound` —
 * this is deliberately not a schema-shaped guarantee. The rule is that
 * NOTHING the sandbox chooses reaches the telemetry path as a raw string,
 * held here rather than borrowed from a validator one package away.
 */
export function shellErrorCategory(phase: string): ShellErrorCategory {
  return (SHELL_ERROR_CATEGORIES as readonly string[]).includes(phase)
    ? (phase as ShellErrorCategory)
    : 'unknown';
}

export type ShellTheme = 'light' | 'dark';

/**
 * The identity of a sandbox session: the exact bundle bytes and the exact
 * spec revision the sandbox was initialized with. A session cannot be
 * *updated* onto a new revision — `spec` is captured at construction, is
 * what every `init` carries, and is what every inbound invoke is
 * cross-checked against. So when either half of this key changes the host
 * must throw the whole sandbox away and start a new one (a new element, a
 * new document load, a new `ready`, a new `init`) rather than re-pointing
 * the existing session at a spec the running sandbox has never seen.
 *
 * Used as the React `key` of the sandbox host, which is what makes
 * "replace the session" a REMOUNT rather than a mutation of the live
 * frame — see the host's teardown comment for why that distinction is
 * load-bearing.
 */
export function sandboxSessionKey(spec: SurfaceSpec): string {
  return `${spec.bundle.sha256}:${spec.specRevision}`;
}

export interface SandboxSessionOptions {
  spec: SurfaceSpec;
  initialState: JsonObject;
  theme: ShellTheme;
  canInvoke: boolean;
  /** deliver one serialized host→shell message into the sandbox */
  post: (serialized: string) => void;
  /** a validated, revision-cross-checked invoke — actionId only */
  onInvoke: (actionId: string) => void;
  onShellError?: (phase: string, message: string) => void;
  onReady?: () => void;
}

export interface SandboxSession {
  /** raw inbound data from the sandbox (string or structured) */
  handleInbound(raw: unknown): void;
  updateState(state: JsonObject): void;
  updateTheme(theme: ShellTheme): void;
  updatePermission(canInvoke: boolean): void;
  isReady(): boolean;
}

export function createSandboxSession(
  options: SandboxSessionOptions
): SandboxSession {
  const { spec } = options;
  let state = options.initialState;
  let theme = options.theme;
  let canInvoke = options.canInvoke;
  let ready = false;
  let telemetryReports = 0;

  function post(message: unknown) {
    try {
      options.post(JSON.stringify(message));
    } catch (error) {
      logger.log('sandbox post failed', error);
    }
  }

  function sendInit() {
    post({
      type: 'init',
      protocolVersion: 1,
      spec,
      state,
      theme,
      canInvoke,
    });
  }

  return {
    handleInbound(raw: unknown) {
      let data: unknown = raw;
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch {
          logger.log('dropping non-JSON sandbox message');
          return;
        }
      }
      const parsed = ShellToHostMessageSchema.safeParse(data);
      if (!parsed.success) {
        logger.log('dropping invalid sandbox message', data);
        return;
      }
      const message = parsed.data;
      switch (message.type) {
        case 'ready':
          ready = true;
          sendInit();
          options.onReady?.();
          return;
        case 'invoke':
          // trust our own state, not the message: a revision that isn't
          // the one we initialized this sandbox with means the sandbox is
          // stale — drop it.
          if (message.specRevision !== spec.specRevision) {
            logger.log('dropping stale-revision invoke', {
              got: message.specRevision,
              expected: spec.specRevision,
            });
            return;
          }
          // the shell disables controls when permission is off, but that
          // is the sandbox's chrome, not a gate: re-check the permission
          // this session currently holds.
          if (!canInvoke) {
            logger.log('dropping invoke without write permission', {
              actionId: message.actionId,
            });
            return;
          }
          // and only actions this session's spec actually declares —
          // own-property, so no inherited name resolves as an action.
          if (getDeclaredAction(spec, message.actionId) === undefined) {
            logger.log('dropping undeclared-action invoke', {
              actionId: message.actionId,
            });
            return;
          }
          options.onInvoke(message.actionId);
          return;
        case 'error':
          // The sandbox chooses both `phase` and `message`, so the two
          // consumers get different treatment:
          //
          // - TELEMETRY (`trackError` → the configured PostHog/Sentry
          //   logger) LEAVES THE DEVICE, so nothing the sandbox chose
          //   goes into it — not even a truncated prefix. Truncation and
          //   the per-session cap bound the VOLUME of an exfiltration
          //   channel; they do not close it, and a bundle that wants to
          //   ship scraped state off the device is content to do so a few
          //   hundred bytes at a time. The payload is therefore entirely
          //   host-derived: the reported phase mapped onto a fixed enum,
          //   plus which of the permitted reports this is.
          // - The local dev log and `onShellError` get the full strings,
          //   because both stay in this process — the dev log is
          //   console/debug-store only, and `onShellError` is the host
          //   component's own error UI, where the developer looking at a
          //   broken dashboard is exactly who should see the message.
          logger.log(
            'surface shell reported an error',
            message.phase,
            message.message
          );
          if (telemetryReports < SHELL_ERROR_TELEMETRY_REPORT_LIMIT) {
            telemetryReports += 1;
            logger.trackError('surface shell reported an error', {
              phase: shellErrorCategory(message.phase),
              reportIndex: telemetryReports,
            });
          }
          options.onShellError?.(message.phase, message.message);
          return;
      }
    },
    updateState(nextState: JsonObject) {
      state = nextState;
      if (ready) {
        post({ type: 'state', state: nextState });
      }
    },
    updateTheme(nextTheme: ShellTheme) {
      theme = nextTheme;
      if (ready) {
        post({ type: 'theme', theme: nextTheme });
      }
    },
    updatePermission(nextCanInvoke: boolean) {
      canInvoke = nextCanInvoke;
      if (ready) {
        post({ type: 'permission', canInvoke: nextCanInvoke });
      }
    },
    isReady() {
      return ready;
    },
  };
}
