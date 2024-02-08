import * as db from '@db';
import {atom, createStore, useAtom} from 'jotai';
import {useCallback, useMemo} from 'react';

export const appStore = createStore();

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
