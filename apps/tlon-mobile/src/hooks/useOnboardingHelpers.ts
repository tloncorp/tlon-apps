import { NavigationProp, useNavigation } from '@react-navigation/native';
import { useShip } from '@tloncorp/app/contexts/ship';
import {
  AnalyticsEvent,
  HostedNodeStatus,
  createDevLogger,
} from '@tloncorp/shared';
import { storage } from '@tloncorp/shared/db';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useCallback } from 'react';

import { useSignupContext } from '../lib/signupContext';
import { OnboardingStackParamList } from '../types';

const logger = createDevLogger('useOnboardingHelpers', true);

export function useOnboardingHelpers() {
  const navigation = useNavigation<NavigationProp<OnboardingStackParamList>>();
  const signupContext = useSignupContext();
  const { setShip } = useShip();

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
            navigation.navigate('RequestPhoneVerify');
            return;
        }
      }

      console.log('proceeding to step 2', maybeAccountIssue);

      // Step 2: Verify node status
      const nodeId = await db.hostedUserNodeId.getValue();
      console.log('checking node status', nodeId);
      const nodeStatus = await store.checkHostingNodeStatus();
      if (nodeStatus !== HostedNodeStatus.Running) {
        if (nodeStatus === HostedNodeStatus.UnderMaintenance) {
          navigation.navigate('UnderMaintenance');
        } else {
          navigation.navigate('GettingNodeReadyScreen', {
            waitType: nodeStatus,
          });
        }
      }

      // Step 3: Authenticate with node
      console.log('authenticating with node', nodeId);
      const shipInfo = await store.authenticateWithReadyNode();
      if (!shipInfo) {
        logger.trackError(AnalyticsEvent.LoginAnomaly, {
          context: 'Failed to authenticate.',
        });
        throw new Error(
          'Could not authenticate with your Peer-to-peer Node, please try again.'
        );
      }
      logger.log('authenticated with node', shipInfo);
      setShip(shipInfo);
    },
    [navigation, setShip, signupContext]
  );

  return {
    handleLogin,
  };
}
