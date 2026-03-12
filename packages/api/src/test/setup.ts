import { internalConfigureClient } from '../client/urbit';

// @ts-expect-error needed by files that reference __DEV__
global.__DEV__ = true;

internalConfigureClient({
  shipName: 'solfer-magfed',
  shipUrl: 'http://localhost:8080',
});
