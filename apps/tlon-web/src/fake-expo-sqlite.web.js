// This is necessary to make vite happy, as it will try to import the SQLite API from expo-sqlite

// eslint-disable-next-line import/prefer-default-export
export const openDatabaseSync = () => {
  console.warn('SQLite is not available in the web environment.');
  return null;
};
