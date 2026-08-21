import { createDevLogger } from '../lib/logger';
import type { KitAttachment } from '../types/attachment';
import { BadResponseError, poke, scry, subscribe } from './urbit';

const logger = createDevLogger('kitsApi', false);

// Wire shapes for the %kits agent (kits-action-1 / kits-update-1 marks).
// See kits/SCHEMA.md and desk/sur/kits.hoon for the source of truth.

export interface KitPlace {
  name: string;
  kind: 'chat' | 'notebook' | 'gallery';
  title: string;
  description: string;
}

export interface KitBinding {
  file: string;
  scope: 'group' | 'dm' | 'agent';
  trigger: string | null;
  load: 'ambient' | 'on-trigger' | 'pulled';
}

export interface KitSchedule {
  id: string;
  cron: string;
  description: string;
}

export interface KitScaffold {
  file: string;
  workspace: string;
}

export interface KitManifest {
  id: string;
  name: string;
  version: string;
  publisher: string;
  description: string;
  image: string | null;
  scope: 'group' | 'dm' | 'agent';
  places: KitPlace[];
  bindings: KitBinding[];
  schedules: KitSchedule[];
  scaffolds: KitScaffold[];
  policy: string | null;
}

export interface Kit {
  manifest: KitManifest;
  files: Record<string, string>;
}

export interface KitInstall {
  id: string;
  version: string;
  publisher: string;
  places: Record<string, string>;
  setup: 'pending' | 'done';
  installed: string;
}

export interface KitInstallMeta {
  title: string;
  description: string;
  image: string;
  cover: string;
}

export type KitUpdate =
  | { kit: Kit }
  | { preview: KitManifest }
  | { kits: KitManifest[] }
  | { installed: { flag: string; install: KitInstall } }
  | { uninstalled: string }
  | { installs: Record<string, KitInstall> };

const kitsAction = (json: unknown) =>
  poke({ app: 'kits', mark: 'kits-action-1', json });

/** Put a kit in the local library (author or sideload). */
export const addKit = (kit: Kit) => kitsAction({ add: { kit } });

/** Start a two-step fetch of a kit from a publisher ship. */
export const fetchKit = (ship: string, id: string) =>
  kitsAction({ fetch: { ship, id } });

/**
 * Instantiate a kit: create a group + places, write the group blob
 * config, and record the install ledger entry.
 */
export const installKit = (params: {
  id: string;
  name: string;
  meta: KitInstallMeta;
}) => kitsAction({ install: params });

/** Clear the blob config and drop the ledger entry for a group flag. */
export const uninstallKit = (flag: string) =>
  kitsAction({ uninstall: { flag } });

/** Mark a kit's setup conversation as finished for a group flag. */
export const kitSetupDone = (flag: string) =>
  kitsAction({ 'setup-done': { flag } });

/** List the manifests of all kits in the local library. */
export const getKits = async (): Promise<KitManifest[]> => {
  const response = await scry<{ kits: KitManifest[] }>({
    app: 'kits',
    path: '/v1/kits',
  });
  return response.kits;
};

/** Get a single kit (manifest + files) by id, or null if absent. */
export const getKit = async (id: string): Promise<Kit | null> => {
  try {
    const response = await scry<{ kit: Kit }>({
      app: 'kits',
      path: `/v1/kits/${id}`,
    });
    return response.kit;
  } catch (error) {
    if (error instanceof BadResponseError && error.status === 404) {
      return null;
    }
    throw error;
  }
};

/** Get the install ledger, keyed by group flag. */
export const getInstalls = async (): Promise<Record<string, KitInstall>> => {
  const response = await scry<{ installs: Record<string, KitInstall> }>({
    app: 'kits',
    path: '/v1/installs',
  });
  return response.installs;
};

/**
 * The text form of a kit reference: `/1/kit/<publisher-ship>/<kit-id>`,
 * e.g. `/1/kit/~sampel-palnet/book-club`. Unanchored so it can match refs
 * embedded in pasted text.
 */
export const KIT_REF_REGEX = /\/1\/kit\/(~[a-z0-9-]+)\/([a-z0-9-]+)/;

/** Render a kit reference path for a kit's publisher + id. */
export const kitRefPath = (publisher: string, id: string) =>
  `/1/kit/${publisher}/${id}`;

/**
 * Parse a kit reference path into a bare kit attachment, or null if the
 * text doesn't contain one.
 */
export function kitAttachmentFromRef(path: string): KitAttachment | null {
  const match = path.match(KIT_REF_REGEX);
  if (!match) {
    return null;
  }
  const [, publisher, id] = match;
  return { type: 'kit', publisher, id };
}

/**
 * Best-effort enrichment of a bare kit attachment from the local kit
 * library. Returns an enriched copy when the library has a matching kit
 * within `timeoutMs`; otherwise returns the input attachment unchanged.
 */
export async function enrichKitAttachment(
  attachment: KitAttachment,
  timeoutMs = 2000
): Promise<KitAttachment> {
  try {
    const kit = await Promise.race([
      getKit(attachment.id),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), timeoutMs)
      ),
    ]);
    if (kit && kit.manifest.publisher === attachment.publisher) {
      return {
        ...attachment,
        version: kit.manifest.version,
        name: kit.manifest.name,
        description: kit.manifest.description,
        image: kit.manifest.image,
      };
    }
  } catch (error) {
    logger.log('kit attachment enrichment failed', {
      kit: `${attachment.publisher}/${attachment.id}`,
      error,
    });
  }
  return attachment;
}

/** Subscribe to %kits facts on /v1/updates. */
export const subscribeKitUpdates = (handler: (update: KitUpdate) => void) =>
  subscribe<KitUpdate>({ app: 'kits', path: '/v1/updates' }, (event) => {
    logger.log('kits update', event);
    handler(event);
  });
