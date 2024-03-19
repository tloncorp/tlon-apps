// This is necessary to make vite happy, as it will try to import the SQLite API from expo-sqlite

export const openDatabaseSync = () => {
  console.warn('SQLite is not available in the web environment.');
  return null;
};
