import * as db from '@db';
import {useCallback} from 'react';

export const useLogOut = () => {
  const realm = db.useRealm();
  return useCallback(() => {
    realm.write(() => {
      realm.delete(realm.objects('Account')[0]);
    });
  }, [realm]);
};
