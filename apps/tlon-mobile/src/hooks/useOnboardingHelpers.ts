import { NavigationProp, useNavigation } from '@react-navigation/native';
import * as api from '@tloncorp/api';
import { useShip } from '@tloncorp/app/contexts/ship';
import { useConfigureUrbitClient } from '@tloncorp/app/hooks/useConfigureUrbitClient';
import { useStore } from '@tloncorp/app/ui';
import {
  AnalyticsEvent,
  AnalyticsSeverity,
  HostedNodeStatus,
  createDevLogger,
  scaffoldPersonalGroup,
  withRetry,
} from '@tloncorp/shared';
import { storage } from '@tloncorp/shared/db';
import * as db from '@tloncorp/shared/db';
import { useCallback } from 'react';

import { clearHostingNativeCookie } from '../lib/hostingAuth';
import { useSignupContext } from '../lib/signupContext';
import { OnboardingStackParamList } from '../types';

const logger = createDevLogger('useOnboardingHelpers', true);

export function useOnboardingHelpers() {
  const store = useStore();
  const navigation = useNavigation<NavigationProp<OnboardingStackParamList>>();
  const signupContext = useSignupContext();
  const configureUrbitClient = useConfigureUrbitClient();
  const { setShip, ship, shipUrl } = useShip();

  const checkAccountStatusAndNavigate = useCallback(async () => {
    const accountIssue = await store.checkAccountStatus();

    if (accountIssue === store.HostingAccountIssue.NoAssignedShip) {
      navigation.navigate('ReserveShip');
      return true;
    }

    if (accountIssue === store.HostingAccountIssue.RequiresVerification) {
      navigation.navigate('RequestPhoneVerify', { mode: 'login' });
      return true;
    }

    if (!accountIssue) {
      navigation.navigate('GettingNodeReadyScreen', { waitType: 'Unknown' });
    }
  }, [navigation, store]);

  const reviveLoggedInSession = useCallback(async () => {
    const hostingUserId = await db.hostingUserId.getValue();
    if (!hostingUserId) {
      logger.log('no hosting user ID found, not reviving');
      return false;
    }

    // make sure hosting session is still valid
    const result = await api.getHostingHeartBeat();
    if (result === 'expired') {
      logger.log('hosting auth expired, not reviving');
      return false;
    }

    // if the account has an issue,
    const hasAccountIssue = await store.checkAccountStatus();
    if (hasAccountIssue) {
      logger.log('hosting account has issues, not reviving');
      return false;
    }

    navigation.navigate('GettingNodeReadyScreen', { waitType: 'Unknown' });
    return true;
  }, [navigation, store]);

  const handleGuidedLogin = useCallback(
    async (inputShipInfo?: db.ShipInfo) => {
      try {
        logger.trackEvent(AnalyticsEvent.WayfindingDebug, {
          context: 'revival login: starting',
        });

        signupContext.setOnboardingValues({ isGuidedLogin: true });
        navigation.navigate('SetNickname');

        // we won't have set up the connection yet, so do that first
        const shipInfoToUse = inputShipInfo
          ? { shipName: inputShipInfo.ship, shipUrl: inputShipInfo.shipUrl }
          : { shipName: ship, shipUrl }; // default to existing if none passed in
        configureUrbitClient(shipInfoToUse);
        store.syncStart();

        // finally, reset the ships revival status in Hosting
        store
          .clearShipRevivalStatus()
          .then(() => {
            logger.trackEvent('Toggled Hosting Revival Status');
          })
          .catch((e) => {
            logger.trackEvent(AnalyticsEvent.ErrorWayfinding, {
              error: e,
              context: 'failed to clear revival status',
              severity: AnalyticsSeverity.High,
            });
          });
      } catch (e) {
        logger.trackEvent(AnalyticsEvent.ErrorWayfinding, {
          error: e,
          context: 'failed to scaffold personal group',
          during: 'mobile revival login (useOnboardingHelpers)',
          severity: AnalyticsSeverity.Critical,
        });
      }
    },
    [configureUrbitClient, navigation, signupContext, store]
  );

  const handleLogin = useCallback(
    async (params: {
      email?: string;
      phoneNumber?: string;
      otp?: string;
      password?: string;
    }) => {
      const eulaAgreed = await storage.eulaAgreed.getValue();
      if (!eulaAgreed) {
        throw new Error(
          'Please agree to the End User License Agreement to continue.'
        );
      }

      // Step 1: Attempt login and handle account issues
      logger.log('attempting to log in', params);
      const maybeAccountIssue = await store.logInHostedUser(params);

      // clear native managed cookie since we set manually
      await clearHostingNativeCookie();

      logger.trackEvent(AnalyticsEvent.UserLoggedIn, {
        email: params.email,
        phoneNumber: params.phoneNumber,
        client: 'tlon-mobile',
      });

      if (maybeAccountIssue) {
        switch (maybeAccountIssue) {
          // If the account has no assigned ship, treat it as a signup
          case store.HostingAccountIssue.NoAssignedShip:
            signupContext.setOnboardingValues({
              phoneNumber: params.phoneNumber,
              email: params.email,
            });
            navigation.navigate('ReserveShip');
            return;
          case store.HostingAccountIssue.RequiresVerification:
            navigation.navigate('RequestPhoneVerify', { mode: 'login' });
            return;
        }
      }

      // Step 2: Verify node status
      const nodeId = await db.hostedUserNodeId.getValue();
      console.log('checking node status', nodeId);
      const { status: nodeStatus, guideFirstLogin } =
        await store.checkHostingNodeStatus();
      if (nodeStatus !== HostedNodeStatus.Running) {
        if (nodeStatus === HostedNodeStatus.UnderMaintenance) {
          logger.trackEvent(AnalyticsEvent.LoginAnomaly, {
            context: 'User node was under maintenance at login',
            nodeId,
          });
          navigation.navigate('UnderMaintenance');
          return;
        } else {
          logger.trackEvent(AnalyticsEvent.LoginAnomaly, {
            context: 'User node was not running at login',
            nodeStatus,
            nodeId,
          });
          navigation.navigate('GettingNodeReadyScreen', {
            waitType: nodeStatus,
          });
          return;
        }
      }

      if (!guideFirstLogin) {
        await db.hostedAccountIsInitialized.setValue(true);
      }
      await db.hostedNodeIsRunning.setValue(true);

      // Step 3: Authenticate with node
      console.log('authenticating with node', nodeId);
      const shipInfo = await store.authenticateWithReadyNode();
      if (!shipInfo) {
        navigation.navigate('GettingNodeReadyScreen', { waitType: 'Unknown' });
        return;
      }
      logger.log('authenticated with node', shipInfo);

      // make sure we show them the wayfinding splash if they're being revived
      setShip({ ...shipInfo, needsSplashSequence: guideFirstLogin });

      // Step 4: if they're being revived, attempt to scaffold the personal group
      if (guideFirstLogin) {
        handleGuidedLogin(shipInfo);
      }
    },
    [handleGuidedLogin, navigation, setShip, signupContext, store]
  );

  return {
    handleLogin,
    handleGuidedLogin,
    checkAccountStatusAndNavigate,
    reviveLoggedInSession,
  };
}
