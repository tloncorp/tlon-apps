import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '@tloncorp/shared/api';
import { ConnectionStatus } from '@tloncorp/shared/api';
import { debounce } from 'lodash';

import { useCurrentUserId } from '../../ui';

interface ConnectivityCheckOptions {
  enabled?: boolean;
  staleTime?: number;
}

const emptyConnectionStatus: ConnectionStatus = {
  status: 'setting-up',
  complete: false,
};

export const useShipConnectionStatus = (
  contactId: string,
  options?: ConnectivityCheckOptions
) => {
  const currentUserId = useCurrentUserId();
  const isSelf = currentUserId === contactId;
  const queryClient = useQueryClient();
  const queryKey = ['connectionStatus', contactId];
  const { enabled = true, staleTime = 60 * 1000 } = options || {};

  const { data } = useQuery<ConnectionStatus>({
    queryKey,
    queryFn: async () => {
      api.checkConnectionStatus(
        contactId,
        debounce(
          (status: ConnectionStatus) => {
            queryClient.setQueryData<ConnectionStatus>(queryKey, status);
          },
          500,
          { trailing: true }
        )
      );

      return emptyConnectionStatus;
    },
    enabled: enabled && !isSelf,
    staleTime,
    initialData: self
      ? {
          status: 'yes',
          complete: true,
        }
      : undefined,
    placeholderData: emptyConnectionStatus,
  });

  return data || emptyConnectionStatus;
};
