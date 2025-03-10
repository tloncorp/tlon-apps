import * as electronDb from '../lib/electronDb';
import * as webDb from '../lib/webDb';
import { useIsElectron } from './useIsElectron';

export const useResetDb = () => {
  const isElectron = useIsElectron();

  if (isElectron) {
    return electronDb.resetDb;
  }

  return webDb.resetDb;
};
