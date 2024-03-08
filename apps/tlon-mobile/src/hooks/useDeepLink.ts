import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { parseActiveTab } from '@tloncorp/shared';
import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import branch from 'react-native-branch';

import { useShip } from '../contexts/ship';
import { useWebViewContext } from '../contexts/webview/webview';
import { inviteShipWithLure } from '../lib/hostingApi';
import storage from '../lib/storage';
import type { TabParamList } from '../types';
import { trackError } from '../utils/posthog';
import { getPathFromWer } from '../utils/string';

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

export function useDeepLinkListener(initialWer?: string) {
  const navigation = useNavigation<NavigationProp<TabParamList>>();
  const webviewContext = useWebViewContext();
  const { ship } = useShip();
  const { wer, lure, clearDeepLink } = useDeepLink();
  const [gotoPath, setGotoPath] = useState(
    initialWer ? getPathFromWer(initialWer) : ''
  );

  // If lure is present, invite it and mark as handled
  useEffect(() => {
    if (ship && lure) {
      (async () => {
        try {
          await inviteShipWithLure({ ship, lure });
          Alert.alert(
            '',
            'Your invitation to the group is on its way. It will appear in the Groups list.',
            [
              {
                text: 'OK',
                onPress: () => null,
              },
            ],
            { cancelable: true }
          );
        } catch (err) {
          console.error('Error inviting ship with lure:', err);
          if (err instanceof Error) {
            trackError(err);
          }
        }

        clearDeepLink();
      })();
    }
  }, [ship, lure, clearDeepLink]);

  // If deep link clicked, broadcast that navigation update to the
  // webview and mark as handled
  useEffect(() => {
    if (wer) {
      setGotoPath(getPathFromWer(wer));
      clearDeepLink();
    }
  }, [wer, clearDeepLink]);

  useEffect(() => {
    if (gotoPath) {
      webviewContext.setGotoPath(gotoPath);
      const tab = parseActiveTab(gotoPath) ?? 'Groups';
      navigation.navigate(tab, { screen: 'Webview' });
      setGotoPath('');
    }
  }, [gotoPath, clearDeepLink, webviewContext, navigation]);
}
