import storage from '../lib/storage';
import { trackError } from './posthog';

export const isSplashDismissed = async () => {
  try {
    const result = await storage.load<boolean>({ key: 'splash' });
    return result;
  } catch (err) {
    if (err instanceof Error && err.name !== 'NotFoundError') {
      trackError(err);
    }

    return false;
  }
};

export const setSplashDismissed = () =>
  storage.save({ key: 'splash', data: true });
