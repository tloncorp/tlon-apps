import * as api from '@tloncorp/shared/api';
import { ConnectionStatus } from '@tloncorp/shared/api';
import { debounce } from 'lodash';
import { useEffect, useState } from 'react';

import { useCurrentUserId } from '../../ui';

export const useConnectionStatus = (contactId: string) => {
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus | null>(null);
  const currentUserId = useCurrentUserId();

  useEffect(() => {
    if (!contactId || contactId === '') {
      setConnectionStatus(null);
      return;
    }

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
