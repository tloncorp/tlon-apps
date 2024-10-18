import * as api from '../api';
import { createDevLogger } from '../debug';
import { getInitializedClient, updateInitializedClient } from './session';

const logger = createDevLogger('ClientActions', true);

export function configureClient(params: api.ClientParams) {
  const clientInitialized = getInitializedClient();
  if (clientInitialized) {
    logger.log('client already initialized, skipping');
    return;
  }

  api.internalConfigureClient(params);
  updateInitializedClient(true);
}

export function removeClient() {
  api.internalRemoveClient();
  updateInitializedClient(false);
}
