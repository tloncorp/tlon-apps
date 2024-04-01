import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect } from 'react';

import { useWebViewContext } from '../contexts/webview/webview';
import { getHostingUser } from '../lib/hostingApi';
import type { WebViewStackParamList } from '../types';
import { getHostingToken, getHostingUserId } from '../utils/hosting';
import { useLogout } from './useLogout';

export default function useManageAccount(
  navigation: NativeStackNavigationProp<WebViewStackParamList, 'Webview'>
) {
  const { manageAccountState, setManageAccountState } = useWebViewContext();
  const { handleLogout } = useLogout();

  // If the user selected manage account, navigate to the external
  // hosting page
  const navigateToManageAccount = useCallback(async () => {
    const [hostingSession, hostingUserId] = await Promise.all([
      getHostingToken(),
      getHostingUserId(),
    ]);

    navigation.push('ExternalWebView', {
      uri: 'https://tlon.network/account',
      headers: {
        Cookie: hostingSession,
      },
      injectedJavaScript: `localStorage.setItem("X-SESSION-ID", "${hostingUserId}")`,
    });

    setManageAccountState('navigated');
  }, [navigation, setManageAccountState]);

  // If we returned from managing the account, check if the user deleted
  // their account & logout if so
  const checkUserAccount = useCallback(async () => {
    const hostingUserId = await getHostingUserId();
    if (hostingUserId) {
      try {
        const user = await getHostingUser(hostingUserId);
        if (user.verified) {
          return;
        } else {
          handleLogout();
        }
      } catch (err) {
        handleLogout();
      }
    }
    setManageAccountState('initial');
  }, [handleLogout, setManageAccountState]);

  useEffect(() => {
    if (manageAccountState === 'triggered') {
      console.log('hook: manage account trigger detected');
      navigateToManageAccount();
    }

    if (manageAccountState === 'navigated') {
      console.log('hook: manage account navigated detected');
      checkUserAccount();
    }
  }, [
    checkUserAccount,
    handleLogout,
    manageAccountState,
    navigateToManageAccount,
    navigation,
    setManageAccountState,
  ]);
}
