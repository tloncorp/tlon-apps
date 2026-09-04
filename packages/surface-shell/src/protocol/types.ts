/**
 * The bridge protocol (plan §5): the complete message vocabulary between
 * host and shell, deliberately narrow. App code sees none of this — its
 * whole capability surface is `render(state, context)` in and
 * `invoke(actionId)` out; no message type here may widen that.
 *
 * This module is dependency-free: it is the in-sandbox source of truth for
 * shapes. The zod schemas in ./schemas.ts (host-facing) are built over
 * these types and are the canonical validators for everything the host
 * receives.
 */

/**
 * Versioned alongside SHELL_VERSION: bridge changes are shell-major
 * changes (plan §9), so the two move together.
 */
export const PROTOCOL_VERSION = 1;

/**
 * Structural mirror of `Json`/`JsonObject` from
 * `packages/api/src/client/surface/json.ts`. The shell must not import
 * from @tloncorp/api (sandbox boundary), so these MUST be kept in sync
 * with the api definitions by hand — see DECISIONS.md (mirrored-type
 * tracking note). Caps/validity are the host's responsibility; the shell
 * only reads.
 */
export type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [key: string]: Json };

export type JsonObject = { [key: string]: Json };

/**
 * Structural mirror of the subset of `SurfaceSpec`
 * (`packages/api/src/client/surface/schemas.ts`) the shell reads: identity
 * and revision for tagging invokes, the title for chrome-less headers, and
 * the actions map for knowing which actionIds exist. The shell NEVER reads
 * ops — invoke resolution happens in the reducer, host-side. Extra spec
 * fields pass through untouched and unread.
 */
export interface ShellSurfaceAction {
  /** present on the wire; deliberately opaque to the shell */
  [key: string]: unknown;
}

export interface ShellSurfaceSpec {
  surfaceId: string;
  specRevision: number;
  title?: string;
  actions: Record<string, ShellSurfaceAction>;
  [key: string]: unknown;
}

export type ShellTheme = 'light' | 'dark';

/**
 * The second argument to `render`. Time as an EXPLICIT, DISPLAY-ONLY,
 * PER-VIEWER input — the same class as theme, and deliberately not the same
 * class as state.
 *
 * `now` is epoch milliseconds supplied by the HOST. The shell never reads a
 * clock to produce it and never advances it on its own; it holds the last
 * value the host sent and hands it to `render`. That is what makes a capture
 * reproducible: a host that injects a fixed `now` gets byte-identical output
 * from the same bundle and the same state, forever.
 *
 * `null` when the host has supplied nothing — an older host, or a capture
 * harness that deliberately declines to. An app that reads `now` must render
 * something sane for `null`; the paradigm's rule is that the clock is an
 * input you are GIVEN, never one you can go and take.
 */
export interface SurfaceRenderContext {
  now: number | null;
}

/** host → shell */
export type HostInitMessage = {
  type: 'init';
  protocolVersion: number;
  spec: ShellSurfaceSpec;
  state: JsonObject;
  theme: ShellTheme;
  canInvoke: boolean;
  /**
   * Optional and additive: a host that sends nothing leaves `context.now`
   * null, and every bundle written before this field existed ignores the
   * second render argument entirely. That is why this is not a protocol
   * break — see `SHELL_VERSION`'s comment.
   */
  now?: number;
};

export type HostStateMessage = { type: 'state'; state: JsonObject };
export type HostThemeMessage = { type: 'theme'; theme: ShellTheme };
export type HostPermissionMessage = { type: 'permission'; canInvoke: boolean };

/**
 * A new host-supplied timestamp. The host decides when to send one — on an
 * interval for a spec that declares `timeDisplay`, never for one that does
 * not — so the cadence is the host's policy and is visible to the publish
 * gate as a spec field, rather than being a timer the shell started for
 * itself.
 */
export type HostNowMessage = { type: 'now'; now: number };

export type HostToShellMessage =
  | HostInitMessage
  | HostStateMessage
  | HostThemeMessage
  | HostPermissionMessage
  | HostNowMessage;

/** shell → host */
export type ShellReadyMessage = {
  type: 'ready';
  shellVersion: number;
  protocolVersion: number;
};

export type ShellInvokeMessage = {
  type: 'invoke';
  actionId: string;
  /** the revision of the spec the shell is rendering (plan §5) */
  specRevision: number;
};

export type ShellErrorPhase = 'init' | 'render' | 'bridge';

export type ShellErrorMessage = {
  type: 'error';
  phase: ShellErrorPhase;
  message: string;
};

export type ShellToHostMessage =
  | ShellReadyMessage
  | ShellInvokeMessage
  | ShellErrorMessage;

/** Mirrors the api ActionId constraints (≤64 chars, /^[a-z0-9-]+$/). */
export const ACTION_ID_MAX_LENGTH = 64;
export const ACTION_ID_PATTERN = /^[a-z0-9-]+$/;

/** Error reports are diagnostics, not payloads: hard length bound. */
export const ERROR_MESSAGE_MAX_LENGTH = 1024;
