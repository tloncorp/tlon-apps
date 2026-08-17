import type { TlawnOAuthGrant, TlawnOAuthProvider } from '@tloncorp/api';

export type McpProviderStatus = 'connected' | 'expired' | 'not-connected';

export interface McpProviderRow {
  displayName: string;
  id: string;
  logoUrl?: string;
  status: McpProviderStatus;
}

const DISABLED_PROVIDER_IDS = new Set(['supabase']);

/** Hosting owns the provider order; the client only adds live grant status. */
export function buildProviderRows(
  providers: TlawnOAuthProvider[],
  grants: TlawnOAuthGrant[]
): McpProviderRow[] {
  const grantsByProvider = new Map(
    grants.map((grant) => [grant.provider.toLowerCase(), grant])
  );

  return providers
    .filter((provider) => !DISABLED_PROVIDER_IDS.has(provider.id.toLowerCase()))
    .map((provider) => {
      const grant = grantsByProvider.get(provider.id.toLowerCase()) ?? null;
      const status =
        grant?.connected && !grant.expired
          ? 'connected'
          : grant
            ? 'expired'
            : 'not-connected';

      return {
        displayName: provider.displayName,
        id: provider.id,
        logoUrl: provider.logoUrl,
        status,
      };
    });
}

const FEATURED_PROVIDER_NAMES = new Set(['gmail']);

/** Keep connected services and key defaults visible in the collapsed menu. */
export function prioritizeMcpMenuProviders(
  providers: McpProviderRow[]
): McpProviderRow[] {
  return [
    ...providers.filter((provider) => provider.status === 'connected'),
    ...providers.filter(
      (provider) =>
        provider.status !== 'connected' &&
        FEATURED_PROVIDER_NAMES.has(provider.displayName.toLowerCase())
    ),
    ...providers.filter(
      (provider) =>
        provider.status !== 'connected' &&
        !FEATURED_PROVIDER_NAMES.has(provider.displayName.toLowerCase())
    ),
  ];
}
