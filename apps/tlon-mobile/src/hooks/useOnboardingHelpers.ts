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

  const handleRevivalOnboarding = useCallback(
    async (inputShipInfo?: db.ShipInfo) => {
      const onboardingFlow = 'tlonbotRevival';
      try {
        logger.trackEvent(AnalyticsEvent.WayfindingDebug, {
          context: 'revival onboarding: starting',
          onboardingFlow,
        });

        const shipId =
          inputShipInfo?.ship ?? (await db.hostedUserNodeId.getValue());
        logger.trackEvent(AnalyticsEvent.InitiatedTlonbotRevival, {
          source: 'post_login',
        });
        await db.tlonbotRevivalSetup.setValue((current) => ({
          ...current,
          pending: true,
          applied: false,
          provisioningStarted: current.provisioningStarted ?? false,
          stage: current.stage ?? 'collecting',
          shipId: shipId ?? undefined,
        }));

        await db.hostedAccountIsInitialized.setValue(false);
        signupContext.setOnboardingValues({
          onboardingFlow,
        });

        // we won't have set up the connection yet, so do that first
        const shipInfoToUse = inputShipInfo
          ? { shipName: inputShipInfo.ship, shipUrl: inputShipInfo.shipUrl }
          : { shipName: ship, shipUrl }; // default to existing if none passed in
        configureUrbitClient(shipInfoToUse);

        // Pull fresh contacts from the ship so SetNickname's revival prefill
        // reads an up-to-date nickname rather than a stale local cache.
        try {
          await store.syncContacts();
        } catch (e) {
          logger.trackEvent(AnalyticsEvent.WayfindingDebug, {
            context: 'revival onboarding: contact pre-sync failed',
            error: e,
          });
        }

        navigation.navigate('SetNickname');
        store.syncStart();

        // Clear the Hosting revival flag only after the user completes revival
        // onboarding.
      } catch (e) {
        logger.trackEvent(AnalyticsEvent.ErrorWayfinding, {
          error: e,
          context: 'failed to start revival onboarding',
          during: 'mobile revival onboarding (useOnboardingHelpers)',
          severity: AnalyticsSeverity.Critical,
        });
      }
    },
    [configureUrbitClient, navigation, ship, shipUrl, signupContext, store]
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
      const { status: nodeStatus, onboardingFlow } =
        await store.checkHostingNodeStatus();
      const revivalFlow = onboardingFlow;
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

      if (revivalFlow) {
        await db.hostedAccountIsInitialized.setValue(false);
      } else {
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

      // make sure we show them the right splash if they're being revived
      const nextShipInfo = {
        ...shipInfo,
        needsSplashSequence: !!revivalFlow,
        splashSequenceMode: revivalFlow,
      };
      setShip(nextShipInfo);

      // Step 4: if they're being revived, collect profile and notification prefs
      if (revivalFlow) {
        handleRevivalOnboarding(nextShipInfo);
      }
    },
    [handleRevivalOnboarding, navigation, setShip, signupContext, store]
  );

  return {
    handleLogin,
    handleRevivalOnboarding,
    checkAccountStatusAndNavigate,
    reviveLoggedInSession,
  };
}
