import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createDevLogger } from '@tloncorp/shared';
import * as api from '@tloncorp/shared/api';
import { ConnectionStatus } from '@tloncorp/shared/api';
import { debounce } from 'lodash';

import { useCurrentUserId } from '../../ui';

const logger = createDevLogger('useShipConnectionStatus', false);

export interface ConnectivityCheckOptions {
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

  const { data, isStale, isFetching, dataUpdatedAt } =
    useQuery<ConnectionStatus>({
      queryKey,
      queryFn: async () => {
        logger.log(
          `Initiating new connection check for ${contactId}`,
          Date.now()
        );
        api.checkConnectionStatus(
          contactId,
          debounce(
            (status: ConnectionStatus) => {
              const diff = Date.now() - (status.timestamp ?? 0);
              logger.log(
                `Received status update for ${contactId}:`,
                status,
                Date.now(),
                `(${diff}ms since last update)`
              );
              // update the query data only if the status is recent.
              // generally this happens because the subscription returns
              // any data it has cached, which may be old
              if (diff < staleTime) {
                logger.log(
                  `Updating query data for ${contactId} with status:`,
                  status
                );
                queryClient.setQueryData<ConnectionStatus>(queryKey, status);
                return status?.complete;
              }

              return false;
            },
            500,
            { trailing: true, leading: true }
          )
        );

        const lastStatus = queryClient.getQueryData<ConnectionStatus>(queryKey);
        return lastStatus || emptyConnectionStatus;
      },
      enabled: enabled && !isSelf && contactId !== '',
      staleTime,
      initialData: isSelf
        ? {
            status: 'yes',
            complete: true,
          }
        : undefined,
      placeholderData: emptyConnectionStatus,
    });

  logger.debug(`useShipConnectionStatus for ${contactId}:`, {
    data,
    isStale,
    isFetching,
    diff: Date.now() - dataUpdatedAt,
    dataUpdatedAt,
    current: Date.now(),
  });

  return data || emptyConnectionStatus;
};
