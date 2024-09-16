import { DeepLinkMetadata } from '@tloncorp/shared/dist';
import { extractLureMetadata } from '@tloncorp/shared/src/logic';
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import branch from 'react-native-branch';

import { DEFAULT_LURE, DEFAULT_PRIORITY_TOKEN } from '../constants';
import storage from '../lib/storage';
import { getPathFromWer } from '../utils/string';

interface LureData extends DeepLinkMetadata {
  id: string;
}

type Lure = {
  lure: LureData | undefined;
  priorityToken: string | undefined;
};

type State = Lure & {
  deepLinkPath: string | undefined;
};

type ContextValue = State & {
  clearLure: () => void;
  clearDeepLink: () => void;
};

const INITIAL_STATE: State = {
  deepLinkPath: undefined,
  lure: undefined,
  priorityToken: undefined,
};

const STORAGE_KEY = 'lure';

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

const Context = createContext({} as ContextValue);

export const useBranch = () => {
  const context = useContext(Context);

  if (!context) {
    throw new Error(
      'Must call `useBranch` within a `BranchProvider` component.'
    );
  }

  return context;
};

export const useSignupParams = () => {
  const context = useContext(Context);

  if (!context) {
    throw new Error(
      'Must call `useSignupParams` within a `BranchProvider` component.'
    );
  }

  return {
    lureId: context.lure?.id ?? DEFAULT_LURE,
    priorityToken: context.priorityToken ?? DEFAULT_PRIORITY_TOKEN,
  };
};

export const useLureMetadata = () => {
  const context = useContext(Context);

  if (!context) {
    throw new Error(
      'Must call `useLureMetadata` within a `BranchProvider` component.'
    );
  }

  return context.lure ?? null;
};

export const BranchProvider = ({ children }: { children: ReactNode }) => {
  const [{ deepLinkPath, lure, priorityToken }, setState] =
    useState(INITIAL_STATE);

  useEffect(() => {
    console.debug('[branch] Subscribing to Branch listener');

    // Subscribe to Branch deep link listener
    const unsubscribe = branch.subscribe({
      onOpenComplete: ({ params }) => {
        // Handle Branch link click
        if (params?.['+clicked_branch_link']) {
          console.debug('[branch] Detected Branch link click');

          if (params.lure) {
            // Link had a lure field embedded
            console.debug('[branch] Detected lure link:', params.lure);
            const nextLure: Lure = {
              lure: {
                ...extractLureMetadata(params),
                id: params.lure as string,
              },
              priorityToken: params.token as string | undefined,
            };
            setState({
              ...nextLure,
              deepLinkPath: undefined,
            });
            saveLure(nextLure);
          } else if (params.wer) {
            // Link had a wer (deep link) field embedded
            const deepLinkPath = getPathFromWer(params.wer as string);
            console.debug('[branch] Detected deep link:', deepLinkPath);
            setState({
              deepLinkPath,
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
        console.debug('[branch] Detected saved lure:', nextLure.lure);
        setState({
          ...nextLure,
          deepLinkPath: undefined,
        });
      }
    })();

    return () => {
      console.debug('[branch] Unsubscribing from Branch listener');
      unsubscribe();
    };
  }, []);

  const clearLure = useCallback(() => {
    console.debug('[branch] Clearing lure state');
    setState((curr) => ({
      ...curr,
      lure: undefined,
      priorityToken: undefined,
    }));
    clearSavedLure();
  }, []);

  const clearDeepLink = useCallback(() => {
    console.debug('[branch] Clearing deep link state');
    setState((curr) => ({
      ...curr,
      deepLinkPath: undefined,
    }));
  }, []);

  return (
    <Context.Provider
      value={{
        deepLinkPath,
        lure,
        priorityToken,
        clearLure,
        clearDeepLink,
      }}
    >
      {children}
    </Context.Provider>
  );
};
