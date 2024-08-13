// Mocks for Tlon modules

jest.mock('../lib/opsqliteConnection', () => {
  const {
    OPSQLite$SQLiteConnection,
  } = require('../lib/__mocks__/opsqliteConnection');
  return { OPSQLite$SQLiteConnection };
});
