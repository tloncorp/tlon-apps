import { z } from 'zod';

import { createDevLogger } from '../lib/logger';

const logger = createDevLogger('workspaceConfig', false);

// A group's workspace config: the bot-facing configuration for a group, stored
// as JSON in the group's `blob`. See docs/tlon-apps/workspace-config.md.
//
// Every member can read the document and any admin can write it, so it holds
// definitions only: nothing secret, no run state. Absent fields mean "inherit".
// Unknown keys are carried through untouched so an older client never drops
// fields a newer one wrote.

export const WORKSPACE_CONFIG_VERSION = 2;

const WorkspaceKitSchema = z
  .object({
    /** `~publisher/kit-id@version` */
    ref: z.string().min(1),
    /** abstract place name -> channel nest */
    places: z.record(z.string()).default({}),
  })
  .passthrough();

export interface WorkspaceKit {
  ref: string;
  places: Record<string, string>;
  [key: string]: unknown;
}

const WorkspaceConfigSchema = z
  .object({
    version: z.literal(WORKSPACE_CONFIG_VERSION),
    /** the bot ship this workspace's config is for */
    bot: z.string().min(1).optional(),
    /** free text the bot loads on every turn in the workspace */
    instructions: z.string().optional(),
    /** workspace defaults; contents not yet defined */
    defaults: z.record(z.unknown()).optional(),
    /** provenance: kits that built this workspace */
    kits: z.array(z.unknown()).optional(),
  })
  .passthrough();

// Declared rather than inferred: `Omit` over the passthrough schema's index
// signature would erase the named fields.
export interface WorkspaceConfig {
  version: typeof WORKSPACE_CONFIG_VERSION;
  bot?: string;
  instructions?: string;
  defaults?: Record<string, unknown>;
  kits?: WorkspaceKit[];
  [key: string]: unknown;
}

/**
 * How a group's blob reads as a workspace config.
 *
 * - `empty`: no blob; the workspace is unconfigured
 * - `config`: a workspace config this client understands
 * - `newer`: a workspace config from a later version; readable as
 *   unconfigured, but must not be rewritten
 * - `foreign`: some other payload; must not be rewritten
 */
export type WorkspaceConfigBlob =
  | { kind: 'empty' }
  | { kind: 'config'; config: WorkspaceConfig }
  | { kind: 'newer'; version: number }
  | { kind: 'foreign' };

export function parseWorkspaceConfigBlob(
  blob: string | null | undefined
): WorkspaceConfigBlob {
  if (!blob) {
    return { kind: 'empty' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(blob);
  } catch (error) {
    logger.log('group blob is not JSON', { error });
    return { kind: 'foreign' };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { kind: 'foreign' };
  }
  const version = (parsed as { version?: unknown }).version;
  if (typeof version === 'number' && version > WORKSPACE_CONFIG_VERSION) {
    return { kind: 'newer', version };
  }

  const result = WorkspaceConfigSchema.safeParse(parsed);
  if (!result.success) {
    return { kind: 'foreign' };
  }

  const { kits, ...rest } = result.data;
  const config: WorkspaceConfig = { ...rest };
  if (kits) {
    config.kits = kits.flatMap((entry) => {
      const kit = WorkspaceKitSchema.safeParse(entry);
      if (!kit.success) {
        logger.log('skipping malformed workspace kit entry', { entry });
        return [];
      }
      return [kit.data];
    });
  }
  return { kind: 'config', config };
}

/**
 * Read a group's workspace config. Returns null when the workspace is
 * unconfigured, which includes a blob this client can't interpret.
 */
export function readWorkspaceConfig(
  blob: string | null | undefined
): WorkspaceConfig | null {
  const parsed = parseWorkspaceConfigBlob(blob);
  return parsed.kind === 'config' ? parsed.config : null;
}

export class WorkspaceConfigWriteError extends Error {
  constructor(readonly blobKind: 'newer' | 'foreign') {
    super(
      blobKind === 'newer'
        ? 'group blob holds a newer workspace config version'
        : 'group blob holds a payload that is not a workspace config'
    );
    this.name = 'WorkspaceConfigWriteError';
  }
}

/**
 * Apply `update` to the workspace config in `blob` and return the blob to
 * write. Edits merge on the client: callers pass the freshest blob they hold
 * and change only the fields they own, and unknown keys pass through.
 *
 * Returns null when the result has nothing beyond its version, since an
 * absent document already means "inherit everything". Throws
 * WorkspaceConfigWriteError rather than overwrite a blob it can't interpret.
 */
export function updateWorkspaceConfigBlob(
  blob: string | null | undefined,
  update: (config: WorkspaceConfig) => WorkspaceConfig
): string | null {
  const parsed = parseWorkspaceConfigBlob(blob);
  if (parsed.kind === 'newer' || parsed.kind === 'foreign') {
    throw new WorkspaceConfigWriteError(parsed.kind);
  }

  const current: WorkspaceConfig =
    parsed.kind === 'config'
      ? parsed.config
      : { version: WORKSPACE_CONFIG_VERSION };
  const next = compactWorkspaceConfig({
    ...update(current),
    version: WORKSPACE_CONFIG_VERSION,
  });

  return Object.keys(next).some((key) => key !== 'version')
    ? JSON.stringify(next)
    : null;
}

// Drop known fields that carry no configuration, so clearing a field reads the
// same as never having set it. Unknown keys pass through as written.
function compactWorkspaceConfig(config: WorkspaceConfig): WorkspaceConfig {
  const next: Record<string, unknown> = { ...config };
  if (!next.bot) delete next.bot;
  if (!next.instructions) delete next.instructions;
  if (!config.defaults || Object.keys(config.defaults).length === 0) {
    delete next.defaults;
  }
  if (!config.kits || config.kits.length === 0) delete next.kits;
  return next as WorkspaceConfig;
}
