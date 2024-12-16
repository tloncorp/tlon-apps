import storage from '../lib/storage';

export const setLastScreen = async (screen: { name: string; params: any }) => {
  await storage.save({
    key: 'lastScreen',
    data: screen,
  });
};

export const getLastScreen = async () => {
  try {
    const result = await storage.load({ key: 'lastScreen' });
    return result;
  } catch (err) {
    if (err instanceof Error && err.name !== 'NotFoundError') {
      console.error(err);
    }
    return null;
  }
};
