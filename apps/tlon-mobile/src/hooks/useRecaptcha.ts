import { RECAPTCHA_SITE_KEY } from '@tloncorp/app/constants';
import { createDevLogger } from '@tloncorp/shared';
import { useCallback, useEffect, useState } from 'react';

import { useOnboardingContext } from '../lib/OnboardingContext';

const logger = createDevLogger('recaptcha', true);

export function useRecaptcha() {
  const [initError, setInitError] = useState<Error | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const { initRecaptcha, execRecaptchaLogin } = useOnboardingContext();

  // Initialize reCAPTCHA client
  useEffect(() => {
    (async () => {
      try {
        await initRecaptcha(RECAPTCHA_SITE_KEY, 10_000);
      } catch (err) {
        console.error('Error initializing reCAPTCHA client:', err);
        if (err instanceof Error) {
          setError(err);
          logger.trackError('Error initializing reCAPTCHA client', {
            thrownErrorMessage: err.message,
            siteKey: RECAPTCHA_SITE_KEY,
          });
        }
      }
    })();
  }, []);

  // Re-initialize reCAPTCHA client if an error occurred
  useEffect(() => {
    if (error && !initError) {
      (async () => {
        try {
          await initRecaptcha(RECAPTCHA_SITE_KEY, 10_000);
          setError(null);
          // TODO do we need to re call submit?
          // await onSubmit();
        } catch (err) {
          logger.error('Error re-initializing reCAPTCHA client:', err);
          if (err instanceof Error) {
            logger.trackError('Error re-initializing reCAPTCHA client', {
              thrownErrorMessage: err.message,
              siteKey: RECAPTCHA_SITE_KEY,
            });
            setInitError(err);
          }
        }
      })();
    }
  }, [error, initError, initRecaptcha]);

  const getToken = useCallback(async () => {
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
    }
  }, [execRecaptchaLogin]);

  return {
    errored: !!error && !!initError,
    getToken,
  };
}
