import * as api from '@tloncorp/shared/api';
import { ConnectionStatus } from '@tloncorp/shared/api';
import { useCurrentUserId } from '../../ui';
import { debounce } from 'lodash';
import { useEffect, useState } from 'react';

export const useConnectionStatus = (contactId: string) => {
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus | null>(null);
  const currentUserId = useCurrentUserId();

  useEffect(() => {
    if (currentUserId === contactId) {
      setConnectionStatus({ status: 'yes', complete: true });
    } else {
      api.checkConnectionStatus(
        contactId,
        debounce(setConnectionStatus, 500, { trailing: true })
      );
    }
  }, [contactId, currentUserId]);
  return connectionStatus;
};
