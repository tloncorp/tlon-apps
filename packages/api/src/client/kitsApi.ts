import { createDevLogger } from '../lib/logger';
import { BadResponseError, poke, scry, subscribe } from './urbit';

const logger = createDevLogger('kitsApi', false);

// Wire shapes for the %kits agent (kits-action-1 / kits-update-1 marks).
// See kits/SCHEMA.md and desk/sur/kits.hoon for the source of truth.

export interface KitPlace {
  name: string;
  // Closed vocabulary, matching `placeKindSchema` and `+place-kind` in
  // desk/app/kits.hoon: each kind names the agent that hosts it.
  kind: 'chat' | 'notebook' | 'gallery' | 'notes';
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
  /** Ships whose harness may execute this kit here. */
  agents: string[];
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
  /**
   * The ship whose harness executes this kit - usually a different ship from
   * the installer. Null means "the installer", which is only right when the
   * harness authenticates as the installing ship. Required, not optional: an
   * omitted key fails the decoder, and silently defaulting to the installer is
   * how setup ends up gated on a ship that will never claim it.
   */
  agent: string | null;
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

/** Subscribe to %kits facts on /v1/updates. */
export const subscribeKitUpdates = (handler: (update: KitUpdate) => void) =>
  subscribe<KitUpdate>({ app: 'kits', path: '/v1/updates' }, (event) => {
    logger.log('kits update', event);
    handler(event);
  });
