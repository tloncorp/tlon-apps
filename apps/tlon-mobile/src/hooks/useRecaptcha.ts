import { RECAPTCHA_SITE_KEY } from '@tloncorp/app/constants';
import { createDevLogger } from '@tloncorp/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useOnboardingContext } from '../lib/OnboardingContext';

const logger = createDevLogger('recaptcha', true);

export function useRecaptcha() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const isInitializedRef = useRef(false);
  const { initRecaptcha, execRecaptchaLogin } = useOnboardingContext();

  // Continuously attempt to initialize reCAPTCHA until success or unmount
  useEffect(() => {
    let isMounted = true;
    let retryCount = 0;

    const attemptInitialization = async () => {
      if (!isMounted) return;

      try {
        await initRecaptcha(RECAPTCHA_SITE_KEY, 10_000);

        if (isMounted) {
          isInitializedRef.current = true;
          setIsInitialized(true);
          setError(null);
          logger.log('reCAPTCHA initialized successfully');
        }
      } catch (err) {
        if (!isMounted) return;

        retryCount += 1;

        if (err instanceof Error) {
          setError(err);
          logger.trackError('Error initializing reCAPTCHA client', {
            thrownErrorMessage: err.message,
            siteKey: RECAPTCHA_SITE_KEY,
            retryCount,
          });
        }

        logger.log(
          `Will retry reCAPTCHA initialization in 2 seconds (attempt ${retryCount})`
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
  }, [initRecaptcha]);

  const getToken = useCallback(async () => {
    const startTime = Date.now();
    while (!isInitializedRef.current && Date.now() - startTime < 4000) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (!isInitializedRef.current) {
      const err = new Error(
        'reCAPTCHA initialization timed out after 4 seconds'
      );
      setError(err);
      logger.trackError('reCAPTCHA initialization timeout', {
        thrownErrorMessage: err.message,
      });
      throw err;
    }

    try {
      const token = await execRecaptchaLogin();
      return token;
    } catch (err) {
      console.error('Error executing reCAPTCHA:', err);
      if (err instanceof Error) {
        setError(err);
        logger.trackError('Error executing reCAPTCHA', {
          thrownErrorMessage: err.message,
        });
      }
      throw err;
    }
  }, [execRecaptchaLogin]);

  return {
    errored: !!error && !isInitialized,
    getToken,
  };
}
