import { RECAPTCHA_SITE_KEY } from '@tloncorp/app/constants';
import { createDevLogger } from '@tloncorp/shared';
import { useCallback, useEffect, useRef } from 'react';

import { useOnboardingContext } from '../lib/OnboardingContext';

const logger = createDevLogger('recaptcha', true);

export function useRecaptcha(enabled = true) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const initializationRef = useRef<Promise<string> | null>(null);
  const { initRecaptcha, execRecaptchaLogin, execRecaptchaRequestOtp } =
    useOnboardingContext();

  const initialize = useCallback(() => {
    // A child can request a token before this hook's effect runs.
    if (!initializationRef.current) {
      initializationRef.current = initRecaptcha(
        RECAPTCHA_SITE_KEY,
        10_000
      ).catch((error) => {
        initializationRef.current = null;
        throw error;
      });
    }
    return initializationRef.current;
  }, [initRecaptcha]);

  // Continuously attempt to initialize reCAPTCHA until success or unmount
  useEffect(() => {
    if (!enabled) {
      return;
    }

    let isMounted = true;
    let retryCount = 0;

    const attemptInitialization = async () => {
      if (!isMounted) return;

      try {
        await initialize();

        if (isMounted) {
          logger.trackEvent('reCAPTCHA initialized successfully', {
            siteKey: RECAPTCHA_SITE_KEY,
            retryCount,
          });
        }
      } catch (err) {
        if (!isMounted) return;

        retryCount += 1;

        if (err instanceof Error) {
          logger.trackError('Error initializing reCAPTCHA client', {
            thrownErrorMessage: err.message,
            siteKey: RECAPTCHA_SITE_KEY,
            retryCount,
          });
        }

        logger.log(
          `Will retry reCAPTCHA initialization in 1 second (attempt ${retryCount})`
        );

        // Schedule next attempt after failure
        timeoutRef.current = setTimeout(() => {
          attemptInitialization();
        }, 1000);
      }
    };

    attemptInitialization();

    return () => {
      isMounted = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled, initialize]);

  const getToken = useCallback(
    async (action: 'login' | 'request_otp' = 'login') => {
      if (!enabled) {
        throw new Error('reCAPTCHA is disabled');
      }
      await initialize();

      try {
        return await (action === 'request_otp'
          ? execRecaptchaRequestOtp()
          : execRecaptchaLogin());
      } catch (err) {
        console.error('Error executing reCAPTCHA:', err);
        if (err instanceof Error) {
          logger.trackError('Error executing reCAPTCHA', {
            thrownErrorMessage: err.message,
            action,
          });
        }
        throw err;
      }
    },
    [enabled, initialize, execRecaptchaLogin, execRecaptchaRequestOtp]
  );

  return {
    getToken,
  };
}
