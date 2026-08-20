/**
 * The workspace descriptor: what makes a group a workspace rather than a
 * community, and how any surface reads it.
 *
 * PLAN.md defines a workspace as a group carrying a descriptor — kit identity,
 * agent identities, named places, setup status, schedules, permissions. That is
 * the kit install entry already written into the group's `blob` by `%kits`
 * (`kits/SCHEMA.md` §2), plus the `permissions` capability list. There is no
 * second schema and no second writer: a group is a workspace exactly when its
 * blob carries a kit install.
 *
 * The consequence worth knowing: installing a kit into an existing community
 * makes that community a workspace. v1 only ever installs into groups it
 * created, so this does not arise yet — but it is the seam to watch if `%kits`
 * ever installs into a group it did not make.
 *
 * Everything here fails safe. A group with no blob, an unreadable blob, a blob
 * that is not a kits payload, or a version this build does not understand all
 * read as a plain group. Never as a broken workspace.
 */
import {
  type GroupKitEntry,
  type WorkspaceCapability,
  parseGroupKitConfig,
} from '@tloncorp/api';

/**
 * A workspace's descriptor. Structurally the kit install entry, named for what
 * it means to the product rather than for where it is stored.
 */
export type WorkspaceDescriptor = GroupKitEntry;

/**
 * Anything carrying a group blob. Deliberately structural rather than
 * `db.Group`, so api responses and DB rows both work and this module does not
 * depend on the schema.
 */
export type BlobBearing = { blob?: string | null };

/**
 * Is this group a workspace?
 *
 * False for every group that predates this feature, since they carry no blob.
 * That is the whole reason detection lives in the blob: no migration, and no
 * behaviour change for a group nobody has installed a kit into.
 */
export function isWorkspace(group: BlobBearing | null | undefined): boolean {
  return readWorkspaceDescriptor(group) !== null;
}

/**
 * The group's descriptor, or null when it is not a workspace.
 *
 * v1 is one kit per group, so this reads the first entry. The blob's `kits`
 * array is shaped for composition later; when that lands this becomes "the
 * primary kit" and needs a rule for choosing it.
 */
export function readWorkspaceDescriptor(
  group: BlobBearing | null | undefined
): WorkspaceDescriptor | null {
  if (!group?.blob) {
    return null;
  }
  const config = parseGroupKitConfig(group.blob);
  return config?.kits[0] ?? null;
}

/** The concrete channel nest a kit's abstract place name resolves to. */
export function workspacePlace(
  descriptor: WorkspaceDescriptor | null | undefined,
  place: string
): string | null {
  return descriptor?.places[place] ?? null;
}

/**
 * Has the workspace granted its agent this capability?
 *
 * An unrecognized capability is simply not granted. Enforcement is the
 * executing agent's job; this only reads the grant.
 */
export function workspaceHasCapability(
  descriptor: WorkspaceDescriptor | null | undefined,
  capability: WorkspaceCapability
): boolean {
  return descriptor?.permissions.includes(capability) ?? false;
}

/** Has the kit's setup conversation run? */
export function isWorkspaceSetupComplete(
  descriptor: WorkspaceDescriptor | null | undefined
): boolean {
  return descriptor?.setup === 'done';
}

/** Which ships' agents may execute this workspace's kit. */
export function workspaceAgents(
  descriptor: WorkspaceDescriptor | null | undefined
): string[] {
  return descriptor?.agents ?? [];
}

/** The fields an update may change. */
export type WorkspaceDescriptorPatch = Partial<
  Pick<
    WorkspaceDescriptor,
    'places' | 'schedules' | 'agents' | 'permissions' | 'setup'
  >
>;

/**
 * Apply a patch to the group's descriptor, returning the new blob.
 *
 * Read-modify-write over the **raw** JSON, not over parsed output. That is the
 * load-bearing detail: `parseGroupKitConfig` drops entries it cannot validate
 * and normalizes what it can, so rebuilding from it would erase whatever a
 * newer client wrote — the same destructive mistake as re-emitting a post blob
 * from parsed entries. Only the keys named in the patch are touched; every
 * other key, on the envelope and on the entry, survives byte-for-byte.
 *
 * Returns null when there is nothing to patch: no blob, an unreadable one, or
 * one carrying no kit install. Callers should treat that as "not a workspace"
 * rather than writing a descriptor from scratch — minting one is an install,
 * and that belongs to `%kits`.
 *
 * Writers are last-write-wins on the cord for v1 (`kits/SCHEMA.md`). Two
 * concurrent patches can lose one another; that is accepted at this stage.
 */
export function updateWorkspaceDescriptor(
  blob: string | null | undefined,
  patch: WorkspaceDescriptorPatch
): string | null {
  if (!blob) {
    return null;
  }

  let envelope: unknown;
  try {
    envelope = JSON.parse(blob);
  } catch {
    return null;
  }
  if (!isRecord(envelope) || !Array.isArray(envelope.kits)) {
    return null;
  }

  // Patch the same entry `readWorkspaceDescriptor` reads: the first one this
  // build can parse, so the two never disagree about which kit is the
  // workspace's.
  const targetIndex = envelope.kits.findIndex(
    (entry) => isRecord(entry) && typeof entry.installId === 'string'
  );
  if (targetIndex === -1) {
    return null;
  }

  const kits = envelope.kits.map((entry, index) =>
    index === targetIndex && isRecord(entry) ? { ...entry, ...patch } : entry
  );
  return JSON.stringify({ ...envelope, kits });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The workspace's primary conversation: the first chat-backed place.
 *
 * Kits name their places for what they mean (`kitchen`, `conversation`), and
 * nothing in the manifest marks one as primary — so the type is what
 * identifies it. Every workspace kit declares exactly one chat place, and if
 * one ever declares two, the first is a better guess than failing: onboarding
 * needs somewhere to land, and no conversation at all is worse than the wrong
 * one.
 *
 * Reads the kind off the nest rather than the place name, since the nest is
 * what the backend actually created.
 */
export function workspaceConversation(
  descriptor: WorkspaceDescriptor | null | undefined
): string | null {
  const places = descriptor?.places;
  if (!places) {
    return null;
  }
  for (const nest of Object.values(places)) {
    if (typeof nest === 'string' && nest.startsWith('chat/')) {
      return nest;
    }
  }
  return null;
}
