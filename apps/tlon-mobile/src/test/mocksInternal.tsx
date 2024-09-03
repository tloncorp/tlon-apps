// Mocks for Tlon modules
import { jest } from '@jest/globals';

// HACK: `AuthenticatedApp` triggers a lot of setup that is hard to mock. We'll
// need to remove this mock to test anything within `AuthenticatedApp`.
jest.mock('../components/AuthenticatedApp', () => {
  const { Text } = require('react-native');

  return {
    __esModule: true,
    default: function AuthenticatedApp() {
      return <Text>AuthenticatedApp</Text>;
    },
  };
});

jest.mock('@tloncorp/app/lib/opsqliteConnection', () => {
  const {
    BetterSqlite3$SQLiteConnection,
  } = require('@tloncorp/app/lib/betterSqlite3Connection');
  return { OPSQLite$SQLiteConnection: BetterSqlite3$SQLiteConnection };
});
