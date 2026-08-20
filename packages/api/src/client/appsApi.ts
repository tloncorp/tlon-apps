import { createDevLogger } from '../lib/logger';
import { BadResponseError, poke, scry, subscribe } from './urbit';

const logger = createDevLogger('appsApi', false);

// Wire shapes for the %apps agent (apps-action-1 / apps-update-1 marks).
// See desk/sur/apps.hoon and desk/lib/apps-json.hoon for the source of
// truth, and docs/apps.md for the agent.
//
// Channels are addressed by flag ("~ship/name"), not by nest: an app
// channel's kind is always %apps, so the agent rebuilds the nest itself.

/**
 * One app channel's state.
 *
 * `body` is an opaque JSON string, not parsed JSON. The agent does not
 * look inside it, and neither does this layer — whichever kit owns the
 * surface defines its shape. Use `readAppDocBody` to parse it.
 */
export interface AppDoc {
  /** Flag of the group whose membership governs this channel. */
  group: string;
  /** Roles allowed to write. Empty means any reader may. */
  writers: string[];
  /** Bumped by exactly 1 per applied write. */
  revision: number;
  /** The document, as a JSON string. */
  body: string;
  /** Ids of writes already applied, newest first. */
  applied: string[];
  updated: string;
}

export type AppUpdate =
  | { doc: { flag: string; doc: AppDoc } }
  | { docs: Record<string, AppDoc> }
  | { deleted: string }
  | { conflict: { flag: string; revision: number } };

const appsAction = (json: unknown) =>
  poke({ app: 'apps', mark: 'apps-action-1', json });

/**
 * Create an app channel on our own ship and register it with a group.
 *
 * `readers` rides along on the group listing, which is what makes the
 * group's can-read gate the channel. An empty `writers` means any reader
 * may write.
 *
 * This pokes %apps only. Creating the channel as the app understands it —
 * with the local DB row and the group listing verified — goes through
 * `createAppChannel` in the store.
 */
export const createAppChannel = (params: {
  name: string;
  group: string;
  title: string;
  description: string;
  readers?: string[];
  writers?: string[];
  body: string;
}) =>
  appsAction({
    create: {
      name: params.name,
      group: params.group,
      title: params.title,
      description: params.description,
      readers: params.readers ?? [],
      writers: params.writers ?? [],
      body: params.body,
    },
  });

/**
 * Replace an app channel's document.
 *
 * `id` is the idempotency key: a replay of the same id is a no-op, and
 * the agent sends nothing back for it, so a client that has lost track
 * must re-read rather than wait.
 *
 * `expected` is the revision the writer was looking at. A stale value
 * loses and the agent answers with a `conflict` carrying the revision
 * actually stored. Passing `null` opts into last-write-wins.
 *
 * Writing to a channel hosted elsewhere is allowed: our %apps forwards
 * to the host, which authorizes us for itself.
 */
export const writeAppDoc = (params: {
  flag: string;
  id: string;
  expected: number | null;
  body: string;
}) =>
  appsAction({
    write: {
      flag: params.flag,
      id: params.id,
      expected: params.expected,
      body: params.body,
    },
  });

/** Delete an app channel we host, and its group listing. */
export const deleteAppChannel = (flag: string) =>
  appsAction({ delete: { flag } });

/** Every app channel this ship can read, keyed by flag. */
export const getAppDocs = async (): Promise<Record<string, AppDoc>> => {
  const response = await scry<{ docs: Record<string, AppDoc> }>({
    app: 'apps',
    path: '/v1/docs',
  });
  return response.docs;
};

/**
 * One app channel's document, or null when it is absent — which is also
 * what a channel we have lost read access to looks like.
 */
export const getAppDoc = async (flag: string): Promise<AppDoc | null> => {
  const [ship, name] = splitFlag(flag);
  try {
    const response = await scry<{ doc: { flag: string; doc: AppDoc } }>({
      app: 'apps',
      path: `/v1/doc/${ship}/${name}`,
    });
    return response.doc.doc;
  } catch (error) {
    if (error instanceof BadResponseError && error.status === 404) {
      return null;
    }
    throw error;
  }
};

/** Subscribe to %apps facts for every channel this ship holds. */
export const subscribeAppUpdates = (handler: (update: AppUpdate) => void) =>
  subscribe<AppUpdate>({ app: 'apps', path: '/v1/updates' }, (event) => {
    logger.log('apps update', event);
    handler(event);
  });

/**
 * Parse a document body, returning null rather than throwing on a body
 * this build cannot read.
 *
 * The body is written by whichever kit owns the surface, so a client can
 * legitimately meet one it does not understand. That is a degrade, not an
 * error — the same posture the channel renderer registry takes for a view
 * id it has not registered.
 */
export function readAppDocBody<T = unknown>(doc: AppDoc): T | null {
  try {
    return JSON.parse(doc.body) as T;
  } catch (error) {
    logger.log('unparseable app doc body', { group: doc.group, error });
    return null;
  }
}

function splitFlag(flag: string): [string, string] {
  const separator = flag.indexOf('/');
  if (separator < 1 || separator === flag.length - 1) {
    throw new Error(`appsApi: malformed channel flag "${flag}"`);
  }
  return [flag.slice(0, separator), flag.slice(separator + 1)];
}
