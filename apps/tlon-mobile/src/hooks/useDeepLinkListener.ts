import { useBranch, useSignupParams } from '@tloncorp/app/contexts/branch';
import { useShip } from '@tloncorp/app/contexts/ship';
import { inviteShipWithLure } from '@tloncorp/app/lib/hostingApi';
import { trackError } from '@tloncorp/app/utils/posthog';
import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';

export const useDeepLinkListener = () => {
  const isInvitingRef = useRef(false);
  const { ship } = useShip();
  const signupParams = useSignupParams();
  const { clearLure, lure } = useBranch();

  // If lure is present, invite it and mark as handled
  useEffect(() => {
    if (ship && lure && !isInvitingRef.current) {
      (async () => {
        try {
          console.log(`bl: inviting ship with lure`, ship, signupParams.lureId);
          isInvitingRef.current = true;
          await inviteShipWithLure({ ship, lure: signupParams.lureId });
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
          console.error(
            '[useDeepLinkListener] Error inviting ship with lure:',
            err
          );
          if (err instanceof Error) {
            trackError(err);
          }
        } finally {
          clearLure();
          isInvitingRef.current = false;
        }
      })();
    }
  }, [ship, signupParams, clearLure, lure]);

  // If deep link clicked, broadcast that navigation update to the webview and mark as handled
  // useEffect(() => {
  // TODO: hook up deep links without webview
  // if (deepLinkPath && webviewContext.appLoaded) {
  // console.debug(
  // '[useDeepLinkListener] Setting webview path:',
  // deepLinkPath
  // );
  // webviewContext.setGotoPath(deepLinkPath);
  // const tab = parseActiveTab(deepLinkPath) ?? 'Groups';
  // navigation.navigate(tab, { screen: 'Webview' });
  // clearDeepLink();
  // }
  // }, [deepLinkPath, navigation, clearDeepLink]);
};
