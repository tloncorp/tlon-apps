import { ConnectedAppContent } from './App.main';

// CosmosDbProvider migrates and seeds the isolated fixture database before
// rendering this fixture. Supplying that completed state keeps App.main from
// opening the production native database and replacing the shared DB client.
// eslint-disable-next-line
export default () => (
  <ConnectedAppContent migrationState={{ success: true, error: null }} />
);
