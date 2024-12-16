import storage from '../lib/storage';
import { trackError } from './posthog';

export const hasOpenedDmInvite = async () => {
  try {
    const result = await storage.load<boolean>({ key: 'hasOpenedDmInvite' });
    return result;
  } catch (err) {
    if (err instanceof Error && err.name !== 'NotFoundError') {
      trackError(err);
    }

    return false;
  }
};

export const setHasOpenedDmInvite = () =>
  storage.save({ key: 'hasOpenedDmInvite', data: true });

export const clearHasOpenedDmInvite = () =>
  storage.save({ key: 'hasOpenedDmInvite', data: false });
