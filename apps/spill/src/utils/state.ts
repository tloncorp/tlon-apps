import {atom, useAtom} from 'jotai';
import * as db from '@db';
import {useCallback, useEffect, useMemo, useState} from 'react';
import * as api from '@api';

export const activeDetailViewAtom = atom<db.SchemaModel<any> | null>(null);
export const activeActionsMenuAtom = atom<db.SchemaModel<any> | null>(null);

export const useDetailView = () => {
  const [activeDetailView, setActiveDetailView] = useAtom(activeDetailViewAtom);
  const clearDetailView = useCallback(
    () => setActiveDetailView(null),
    [setActiveDetailView],
  );
  return useMemo(
    () => ({activeDetailView, setActiveDetailView, clearDetailView}),
    [activeDetailView, clearDetailView, setActiveDetailView],
  );
};

export default function useIsLoggedIn() {
  const {url, ship, cookie} =
    db.useObject('Account', db.DEFAULT_ACCOUNT_ID) ?? {};
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    async function authenticate() {
      if (cookie && ship && url && !isLoggedIn) {
        try {
          await api.initWithCookie({
            shipUrl: url,
            ship: ship,
            cookie: cookie,
          });
          setIsLoggedIn(true);
        } catch (e) {
          setIsLoggedIn(false);
        }
      } else if (
        ((!cookie || !ship || !url) && isLoggedIn) ||
        isLoggedIn === null
      ) {
        setIsLoggedIn(false);
      }
    }
    authenticate();
  }, [url, ship, cookie, isLoggedIn]);
  return isLoggedIn;
}
