import type { TlawnOAuthGrant, TlawnOAuthProvider } from '@tloncorp/api';

export const mcpProviderQueryKeys = {
  providers: ['tlonbot', 'oauth-providers'] as const,
  status: (ship: string) => ['tlonbot', 'oauth-status', ship] as const,
};

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

const FEATURED_PROVIDER_ORDER = new Map(
  ['gmail', 'google-calendar', 'notion', 'github'].map((id, index) => [
    id,
    index,
  ])
);

function featuredProviderRank(provider: McpProviderRow): number {
  const normalizedName = provider.displayName
    .toLowerCase()
    .replace(/\s+/g, '-');
  return (
    FEATURED_PROVIDER_ORDER.get(provider.id.toLowerCase()) ??
    FEATURED_PROVIDER_ORDER.get(normalizedName) ??
    Number.POSITIVE_INFINITY
  );
}

/** Keep connected services and the most familiar defaults in the preview. */
export function prioritizeMcpMenuProviders(
  providers: McpProviderRow[]
): McpProviderRow[] {
  return providers
    .map((provider, index) => ({ provider, index }))
    .sort((left, right) => {
      const connectedDelta =
        Number(right.provider.status === 'connected') -
        Number(left.provider.status === 'connected');
      if (connectedDelta !== 0) return connectedDelta;

      const featuredDelta =
        featuredProviderRank(left.provider) -
        featuredProviderRank(right.provider);
      return featuredDelta || left.index - right.index;
    })
    .map(({ provider }) => provider);
}

/**
 * Keep the bounded common-provider preview, but never hide a connected
 * provider whose group-level inclusion can be toggled from this menu.
 */
export function selectMcpMenuProviders(
  providers: McpProviderRow[],
  maxVisible: number
): McpProviderRow[] {
  const preview = providers.slice(0, maxVisible);
  const previewIds = new Set(preview.map((provider) => provider.id));
  return [
    ...preview,
    ...providers.filter(
      (provider) =>
        provider.status === 'connected' && !previewIds.has(provider.id)
    ),
  ];
}
