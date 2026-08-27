/**
 * The bridge protocol (plan §5): the complete message vocabulary between
 * host and shell, deliberately narrow. App code sees none of this — its
 * whole capability surface is `render(state)` in and `invoke(actionId)`
 * out; no message type here may widen that.
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

/** host → shell */
export type HostInitMessage = {
  type: 'init';
  protocolVersion: number;
  spec: ShellSurfaceSpec;
  state: JsonObject;
  theme: ShellTheme;
  canInvoke: boolean;
};

export type HostStateMessage = { type: 'state'; state: JsonObject };
export type HostThemeMessage = { type: 'theme'; theme: ShellTheme };
export type HostPermissionMessage = { type: 'permission'; canInvoke: boolean };

export type HostToShellMessage =
  | HostInitMessage
  | HostStateMessage
  | HostThemeMessage
  | HostPermissionMessage;

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
