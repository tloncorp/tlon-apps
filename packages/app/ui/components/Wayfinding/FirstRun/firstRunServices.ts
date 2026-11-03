import type {
  ConnectStart,
  McpConnectionEvent,
} from '../../../../features/settings/useMcpConnections';
import type {
  McpCatalogEntry,
  McpProviderRow,
} from '../../../../lib/mcpProviders';
import {
  FIRST_RUN_FEATURED_SERVICES,
  type ServiceAccessCopy,
} from './firstRunCopy';

export const MAX_FEATURED_SERVICES = 3;

export type FeaturedService = {
  row: McpProviderRow;
  access: ServiceAccessCopy;
};

/**
 * Where a connection attempt stands, as far as the app knows. "Connected" is
 * never stored here: it comes only from the account's verified grants.
 */
export type ServiceAttempt =
  /** Waiting on the provider's sign-in. */
  | 'connecting'
  /** The person closed the sign-in, or declined it. */
  | 'cancelled'
  /** The sign-in or its start failed. */
  | 'failed'
  /** The provider may have finished, but the grant isn't confirmed yet. */
  | 'checking';

export type FeaturedRowState = 'idle' | 'connected' | ServiceAttempt;

const normalizeScopes = (scopes: string) => {
  const normalized = scopes.split(/\s+/).filter(Boolean).sort().join(' ');
  // The relay writes "whatever the service grants by default" either way.
  return normalized === 'default' ? '' : normalized;
};

const FEATURED_ACCESS = new Map(FIRST_RUN_FEATURED_SERVICES);

/**
 * Whether the catalog offers a featured service with exactly the access its
 * copy describes.
 */
export function catalogOffersFeatured(
  catalog: McpCatalogEntry[],
  providerId: string
): boolean {
  const id = providerId.toLowerCase();
  const access = FEATURED_ACCESS.get(id);
  const provider = catalog.find((entry) => entry.id.toLowerCase() === id);
  return (
    !!access &&
    !!provider &&
    normalizeScopes(provider.scopes) === normalizeScopes(access.scopes)
  );
}

/**
 * The services screen 3 features: the chosen ones the catalog offers, in
 * their chosen order, and only while the catalog still asks for exactly the
 * access their copy describes.
 */
export function selectFeaturedServices(
  catalog: McpCatalogEntry[],
  rows: McpProviderRow[],
  max = MAX_FEATURED_SERVICES
): FeaturedService[] {
  const rowsById = new Map(rows.map((row) => [row.id.toLowerCase(), row]));
  const featured: FeaturedService[] = [];
  for (const [id, access] of FIRST_RUN_FEATURED_SERVICES) {
    const row = rowsById.get(id);
    if (!row || !catalogOffersFeatured(catalog, id)) continue;
    featured.push({ row, access });
    if (featured.length === max) break;
  }
  return featured;
}

const LOGO_BASE = 'https://storage.googleapis.com/tlon-prod-memex-assets/oauth';

/** The live catalog's name and logo for each featured service. */
const FEATURED_LISTING: Record<
  string,
  Pick<McpCatalogEntry, 'displayName' | 'logoUrl'>
> = {
  'google-calendar': {
    displayName: 'Google Calendar',
    logoUrl: `${LOGO_BASE}/google-calendar.png`,
  },
  'google-gmail': {
    displayName: 'Send Gmail',
    logoUrl: `${LOGO_BASE}/google-gmail.png`,
  },
  notion: { displayName: 'Notion', logoUrl: `${LOGO_BASE}/notion.png` },
};

/**
 * The featured services as the live catalog lists them, so screen 3 has its
 * rows the moment the first run opens. The live catalog replaces them as soon
 * as it arrives; a service it drops, or whose access changes, leaves then.
 */
export const FIRST_RUN_FALLBACK_CATALOG: McpCatalogEntry[] =
  FIRST_RUN_FEATURED_SERVICES.flatMap(([id, access]) => {
    const listing = FEATURED_LISTING[id];
    return listing ? [{ id, scopes: access.scopes, ...listing }] : [];
  });

/** What a featured row shows: verified grants win over any attempt. */
export function featuredRowState(
  row: McpProviderRow,
  attempt: ServiceAttempt | undefined
): FeaturedRowState {
  if (row.status === 'connected') return 'connected';
  return attempt ?? 'idle';
}

/**
 * After a sign-in comes back, decide what the row says from a fresh status
 * check. Success from the provider alone is not enough to say connected.
 * When someone taps Check again and the grant still isn't there, the sign-in
 * most likely never finished, so the row goes back to offering Try again.
 */
export function attemptAfterCheck(
  connected: boolean,
  outcome: 'completed' | 'returned' | 'rechecked' | 'failed' | 'canceled'
): ServiceAttempt | undefined {
  if (connected) return undefined;
  switch (outcome) {
    case 'completed':
    case 'returned':
      return 'checking';
    case 'rechecked':
      return 'cancelled';
    case 'failed':
      return 'failed';
    case 'canceled':
      return 'cancelled';
  }
}

/**
 * When the connection hook doesn't start a sign-in, what the row goes back
 * to: idle if something else was running, failed if it can't run at all.
 * A started sign-in reports through events instead, so this returns null.
 */
export function attemptAfterRefusedStart(
  start: ConnectStart
): { attempt: ServiceAttempt | undefined } | null {
  switch (start) {
    case 'started':
      return null;
    case 'busy':
      return { attempt: undefined };
    case 'unavailable':
      return { attempt: 'failed' };
  }
}

/**
 * Whether a connection event also needs a toast. Screen 3's featured rows show
 * their own state, so the toast is for the full services list, and for any
 * service screen 3 doesn't feature.
 */
export function shouldAnnounceConnectionEvent(
  event: McpConnectionEvent,
  {
    allServicesOpen,
    featuredIds,
  }: { allServicesOpen: boolean; featuredIds: string[] }
): boolean {
  if (allServicesOpen) return true;
  // Screen 3 keeps its rows and keeps retrying the catalog by itself.
  if (event.type === 'load-failed') return false;
  if (!event.providerId) return true;
  return !featuredIds.includes(event.providerId.toLowerCase());
}

export function hasConnectedService(rows: McpProviderRow[]) {
  return rows.some((row) => row.status === 'connected');
}
