import type { TlawnOAuthProvider } from '@tloncorp/api';

import type { McpProviderRow } from '../../../../lib/mcpProviders';
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

const normalizeScopes = (scopes: string) =>
  scopes.split(/\s+/).filter(Boolean).sort().join(' ');

/**
 * The services screen 3 features: the chosen ones the live catalog offers,
 * in their chosen order, and only while the catalog still asks for exactly
 * the access their copy describes.
 */
export function selectFeaturedServices(
  catalog: TlawnOAuthProvider[],
  rows: McpProviderRow[],
  max = MAX_FEATURED_SERVICES
): FeaturedService[] {
  const catalogById = new Map(
    catalog.map((provider) => [provider.id.toLowerCase(), provider])
  );
  const rowsById = new Map(rows.map((row) => [row.id.toLowerCase(), row]));
  const featured: FeaturedService[] = [];
  for (const [id, access] of FIRST_RUN_FEATURED_SERVICES) {
    const provider = catalogById.get(id);
    const row = rowsById.get(id);
    if (!provider || !row) continue;
    if (normalizeScopes(provider.scopes) !== normalizeScopes(access.scopes)) {
      continue;
    }
    featured.push({ row, access });
    if (featured.length === max) break;
  }
  return featured;
}

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
 */
export function attemptAfterCheck(
  connected: boolean,
  outcome: 'completed' | 'returned' | 'failed' | 'canceled'
): ServiceAttempt | undefined {
  if (connected) return undefined;
  switch (outcome) {
    case 'completed':
    case 'returned':
      return 'checking';
    case 'failed':
      return 'failed';
    case 'canceled':
      return 'cancelled';
  }
}

export function hasConnectedService(rows: McpProviderRow[]) {
  return rows.some((row) => row.status === 'connected');
}
