import { useQuery } from '@tanstack/react-query';
import { listVaultLogins } from '@tloncorp/api/client/browserVaultManagement';
import { createDevLogger } from '@tloncorp/shared';

import { KERNEL_SERVICE_ORIGIN } from '../../../lib/envVars';

const logger = createDevLogger('SecureVault', false);

// Cache only login metadata so bot settings can warm the list before it opens.
export function useVaultLogins(ship: string, moon: string, enabled: boolean) {
  return useQuery({
    queryKey: ['secure-vault', ship, KERNEL_SERVICE_ORIGIN],
    enabled: enabled && !!KERNEL_SERVICE_ORIGIN,
    retry: false,
    staleTime: 0,
    gcTime: 5 * 60_000,
    queryFn: async ({ signal }) => {
      try {
        const result = await listVaultLogins(moon, signal);
        logger.trackEvent('Secure Vault Listed');
        return result;
      } catch (error) {
        if (!signal.aborted) logger.trackError('Secure Vault list failed');
        throw error;
      }
    },
  });
}
