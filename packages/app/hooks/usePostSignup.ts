import { createDevLogger } from '@tloncorp/shared/dist';
import { updateTelemetrySetting } from '@tloncorp/shared/dist/api';
import * as store from '@tloncorp/shared/dist/store';
import { useCallback } from 'react';

import { useSignupContext } from '../contexts/signup';
import { connectNotifyProvider } from '../lib/notificationsApi';

const logger = createDevLogger('postSignup', true);

export function usePostSignup() {
  const signupContext = useSignupContext();

  const handlePostSignup = useCallback(async () => {
    if (signupContext.nickname) {
      try {
        await store.updateCurrentUserProfile({
          nickname: signupContext.nickname,
        });
      } catch (e) {
        logger.error('Failed to set nickname', e);
      }
    }

    if (typeof signupContext.telemetry !== 'undefined') {
      try {
        await updateTelemetrySetting(signupContext.telemetry);
      } catch (e) {
        logger.error('Failed to set telemetry', e);
      }
    }

    if (signupContext.notificationToken) {
      try {
        await connectNotifyProvider(signupContext.notificationToken);
      } catch (e) {
        logger.error('Failed to connect notify provider', e);
      }
    }

    signupContext.clear();
  }, [signupContext]);

  return handlePostSignup;
}
