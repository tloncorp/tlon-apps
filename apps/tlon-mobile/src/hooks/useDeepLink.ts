import { useCallback, useEffect, useState } from 'react';
import branch from 'react-native-branch';

import storage from '../lib/storage';

type Lure = {
  lure: string | undefined;
  priorityToken: string | undefined;
};

type DeepLink = Lure & {
  wer: string | undefined;
};

const STORAGE_KEY = 'lure';

const INITIAL_DEEP_LINK: DeepLink = {
  wer: undefined,
  lure: undefined,
  priorityToken: undefined,
};

const saveLure = async (lure: Lure) =>
  storage.save({ key: STORAGE_KEY, data: JSON.stringify(lure) });

const getSavedLure = async () => {
  try {
    const lureString = await storage.load<string | undefined>({
      key: STORAGE_KEY,
    });
    return lureString ? (JSON.parse(lureString) as Lure) : undefined;
  } catch (err) {
    return undefined;
  }
};

const clearSavedLure = async () => storage.remove({ key: STORAGE_KEY });

export const useDeepLink = () => {
  const [{ wer, lure, priorityToken }, setDeepLink] =
    useState(INITIAL_DEEP_LINK);

  useEffect(() => {
    // Branch deep linking listener
    const unsubscribeFromBranch = branch.subscribe({
      onOpenComplete: ({ params }) => {
        if (params?.['+clicked_branch_link']) {
          console.debug('Detected Branch link click');
          if (params.lure) {
            console.debug('Detected Lure link:', params.lure);
            const nextLure: Lure = {
              lure: params.lure as string,
              priorityToken: params.token as string | undefined,
            };
            setDeepLink({
              ...nextLure,
              wer: undefined,
            });
            saveLure(nextLure);
          } else if (params.wer) {
            console.debug('Detected deep link:', params.wer);
            setDeepLink({
              wer: params.wer as string,
              lure: undefined,
              priorityToken: undefined,
            });
          }
        }
      },
    });

    // Check for saved lure
    (async () => {
      const nextLure = await getSavedLure();
      if (nextLure) {
        console.debug('Detected saved Lure:', nextLure.lure);
        setDeepLink({
          ...nextLure,
          wer: undefined,
        });
      }
    })();

    return () => {
      unsubscribeFromBranch();
    };
  }, []);

  const clearDeepLink = useCallback(() => {
    setDeepLink(INITIAL_DEEP_LINK);
    clearSavedLure();
  }, []);

  const clearLure = useCallback(() => {
    setDeepLink((curr) => ({
      ...curr,
      lure: undefined,
      priorityToken: undefined,
    }));
    clearSavedLure();
  }, []);

  return {
    wer,
    lure,
    priorityToken,
    clearDeepLink,
    clearLure,
  };
};
