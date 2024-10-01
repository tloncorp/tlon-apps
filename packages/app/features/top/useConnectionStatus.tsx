import * as api from '@tloncorp/shared/dist/api';
import { debounce } from 'lodash';
import { ConnectionStatus } from '@tloncorp/shared/dist/api';
import { useEffect, useState } from 'react';

export const useConnectionStatus = (contactId: string) => {
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus | null>(null);

  useEffect(() => {
    api.checkConnectionStatus(
      contactId,
      debounce(setConnectionStatus, 500, { trailing: true })
    );
  }, [contactId]);
  return connectionStatus;
};
