import * as api from '@tloncorp/api';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { setClient } from '../src/db';
import type { AnySqliteDatabase } from '../src/db/client';
import * as schema from '../src/db/schema';

const here = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = path.resolve(here, '../src/db/migrations');

export interface ShipConfig {
  /** with the sig, e.g. `~zod` */
  name: string;
  url: string;
  code: string;
}

/**
 * The three rube fakeships, matching `apps/tlon-web/e2e/shipManifest.json`.
 * Duplicated rather than imported because the manifest lives in an app
 * package the shared package must not depend on; the seed asserts the
 * ports answer before it does anything, so drift surfaces immediately.
 */
export const SHIPS: Record<'zod' | 'ten', ShipConfig> = {
  zod: {
    name: '~zod',
    url: 'http://localhost:35453',
    code: 'lidlut-tabwed-pillex-ridrup',
  },
  ten: {
    name: '~ten',
    url: 'http://localhost:38473',
    code: 'lapseg-nolmel-riswen-hopryc',
  },
};

/** Web dev server per ship, as `playwright-dev` wires them up. */
export const WEB_URLS: Record<'zod' | 'ten', string> = {
  zod: 'http://localhost:3000',
  ten: 'http://localhost:3002',
};

/**
 * A fresh in-memory client database, migrated to head.
 *
 * The seed drives the real store, which reads and writes the client's own
 * SQLite mirror on every action. Each ship phase gets its own database for
 * the same reason two devices do: the store's global db handle is
 * per-account, and reusing ~zod's rows while acting as ~ten would let the
 * seed "succeed" on state no real ~ten client would ever hold.
 */
export function resetDatabase(): AnySqliteDatabase {
  const sqlite = new Database(':memory:');
  // Match the shipping clients. op-sqlite (mobile), SQLocal (web) and
  // better-sqlite3 (desktop) all leave SQLite's default `foreign_keys`
  // pragma OFF and nothing in the app turns it on; better-sqlite3's
  // *driver* turns it on for new connections, which is the one difference
  // between this process and a real client. Leaving it on would make the
  // seed diverge from the app on writes the app performs happily — see
  // the seed doc's note on the `activity_events` composite key.
  sqlite.pragma('foreign_keys = OFF');
  const client = drizzle(sqlite, { schema }) as unknown as AnySqliteDatabase;
  setClient(client);
  migrate(client as never, { migrationsFolder: MIGRATIONS });
  return client;
}

/**
 * Logs in over HTTP and hands the resulting cookie to a client we
 * construct ourselves, then configures `@tloncorp/api`'s process-global
 * client with it.
 *
 * We do the login rather than calling `Urbit.connect()` because
 * `connect()` treats any 2xx from `/~/login` as a failure, and the vere
 * these fakeships run answers a successful login with `200` plus the
 * `urbauth-` cookie. Skipping `connect()` and injecting the cookie
 * reaches the same authenticated state by the same HTTP exchange.
 */
export async function connectAs(ship: ShipConfig): Promise<void> {
  const response = await fetch(`${ship.url}/~/login`, {
    method: 'POST',
    body: `password=${ship.code}`,
    redirect: 'manual',
  });
  const cookie =
    response.headers.getSetCookie?.()[0] ?? response.headers.get('set-cookie');
  if (!cookie || !cookie.includes('urbauth-')) {
    throw new Error(
      `login to ${ship.name} at ${ship.url} failed (status ${response.status})`
    );
  }

  const client = new api.Urbit(ship.url, ship.code);
  // `cookie` is what the airlock sends as the `Cookie:` header outside a
  // browser; `nodeId`/`our` are what `connect()` would have set from the
  // `urbauth-` cookie it parsed. Both carry the sig.
  client.cookie = cookie;
  client.nodeId = ship.name;
  client.our = ship.name;

  await api.configureClient({
    shipName: ship.name,
    shipUrl: ship.url,
    client,
    getCode: async () => ship.code,
  });

  const currentUserId = api.getCurrentUserId();
  if (currentUserId !== ship.name) {
    throw new Error(
      `configured client reports ${currentUserId}, expected ${ship.name}`
    );
  }
}

export function disconnect(): void {
  api.internalRemoveClient();
}

/** Raw scry, bypassing every client-side transform. */
export async function rawScry<T>(app: string, scryPath: string): Promise<T> {
  return api.scry<T>({ app, path: scryPath });
}

export async function assertShipReachable(ship: ShipConfig): Promise<void> {
  const response = await fetch(`${ship.url}/~/login`, {
    method: 'POST',
    body: `password=${ship.code}`,
    redirect: 'manual',
    signal: AbortSignal.timeout(5000),
  });
  const cookie =
    response.headers.getSetCookie?.()[0] ?? response.headers.get('set-cookie');
  if (!cookie?.includes('urbauth-')) {
    throw new Error(`${ship.name} is not answering at ${ship.url}`);
  }
}
