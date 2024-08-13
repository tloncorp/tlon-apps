// Mock OPSQLite modules to use better-sqlite3 instead.
const Database = require('better-sqlite3');
module.exports = {
  open: ({ name }: { name: string }) => new Database(name),

  // https://github.com/OP-Engineering/op-sqlite/issues/98#issuecomment-2122820151
  isSQLCipher: jest.fn(),
  moveAssetsDatabase: jest.fn(),
};
