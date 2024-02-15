import storage from '../lib/storage';
import { trackError } from './posthog';

export const isEulaAgreed = async () => {
  try {
    const result = await storage.load<boolean>({ key: 'eula' });
    return result;
  } catch (err) {
    if (err instanceof Error && err.name !== 'NotFoundError') {
      trackError(err);
    }

    return false;
  }
};

export const setEulaAgreed = () => storage.save({ key: 'eula', data: true });
