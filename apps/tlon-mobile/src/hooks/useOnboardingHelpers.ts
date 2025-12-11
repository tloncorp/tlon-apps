import { NavigationProp, useNavigation } from '@react-navigation/native';
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
import * as api from '@tloncorp/shared/api';
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
  const { setShip } = useShip();

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

  const handleRevivalLogin = useCallback(
    async (shipInfo: db.ShipInfo) => {
      try {
        logger.trackEvent(AnalyticsEvent.WayfindingDebug, {
          context: 'revival login: starting',
        });

        // we won't have set up the connection yet, so do that first
        configureUrbitClient({
          shipName: shipInfo.ship,
          shipUrl: shipInfo.shipUrl,
        });
        await store.syncStart();

        logger.trackEvent(AnalyticsEvent.WayfindingDebug, {
          context: 'revival login: completed sync start, scaffolding',
        });

        // once we're connected, scaffold the personal group
        await withRetry(() => scaffoldPersonalGroup());

        logger.trackEvent(AnalyticsEvent.WayfindingDebug, {
          context: 'revival login: personal group ready',
        });

        db.wayfindingProgress.setValue((prev) => ({
          ...prev,
          tappedChatInput: false,
          tappedAddCollection: false,
          tappedAddNote: false,
        }));

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
    [configureUrbitClient, store]
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
      const { status: nodeStatus, isBeingRevived } =
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

      // Step 3: Authenticate with node
      console.log('authenticating with node', nodeId);
      const shipInfo = await store.authenticateWithReadyNode();
      if (!shipInfo) {
        navigation.navigate('GettingNodeReadyScreen', { waitType: 'Unknown' });
        return;
      }
      logger.log('authenticated with node', shipInfo);

      // make sure we show them the wayfinding splash if they're being revived
      setShip({ ...shipInfo, needsSplashSequence: isBeingRevived });

      // Step 4: if they're being revived, attempt to scaffold the personal group
      if (isBeingRevived) {
        handleRevivalLogin(shipInfo);
      }
    },
    [handleRevivalLogin, navigation, setShip, signupContext, store]
  );

  return {
    handleLogin,
    handleRevivalLogin,
    checkAccountStatusAndNavigate,
    reviveLoggedInSession,
  };
}
