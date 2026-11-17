import { useQueryClient } from '@tanstack/react-query';
import * as api from '@tloncorp/api';
import { createDevLogger } from '@tloncorp/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';

import { openOAuthUrl } from '../openOAuthUrl';
import {
  OpenAIAuthState,
  getLLMAuthVerificationUrl,
} from './openAiSubscription';
import { OpenAIAuthController } from './openAiSubscriptionController';
import { trackTlonbotSettingUpdated } from './botSettingsTelemetry';

const logger = createDevLogger('LLMSubscriptionAuth', false);

function flowFromState(state: OpenAIAuthState) {
  return 'flow' in state ? state.flow : undefined;
}

export function useOpenAISubscriptionAuth({
  ship,
  provider = 'openai',
  onComplete,
}: {
  ship: string;
  provider?: api.TlawnLLMAuthProvider;
  onComplete: (models: api.TlawnSubscriptionModel[]) => void | Promise<void>;
}) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<OpenAIAuthState>({ phase: 'idle' });
  const [browserError, setBrowserError] = useState<string | null>(null);
  const controllerRef = useRef<OpenAIAuthController | null>(null);
  const browserOpenRef = useRef(false);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!ship) return;
    const controller = new OpenAIAuthController({
      provider,
      now: () => Date.now(),
      schedule: (callback, delayMs) => setTimeout(callback, delayMs),
      cancel: (timer) => clearTimeout(timer),
      start: () => api.startTlawnLLMAuth(ship, provider),
      complete: (flowId, token) =>
        api.completeTlawnLLMAuth(ship, flowId, token),
      poll: (flowId) => api.getTlawnLLMAuthFlow(ship, flowId),
      loadStatus: () => api.getTlawnLLMAuthStatus(ship),
      onComplete: async (models, status) => {
        queryClient.setQueryData(['tlonbot', 'llm-auth-status', ship], status);
        trackTlonbotSettingUpdated({
          setting: 'subscription',
          action: 'connected',
          provider,
        });
        await onCompleteRef.current(models);
      },
    });
    controllerRef.current = controller;
    const unsubscribe = controller.subscribe((nextState) => {
      setState(nextState);
      if (nextState.phase === 'error') {
        logger.trackError('Subscription sign-in failed', { provider });
      }
    });
    setState(controller.getState());

    const appStateSubscription = AppState.addEventListener(
      'change',
      (nextState) => {
        if (nextState === 'active') {
          void controller.resume();
        } else {
          controller.pause();
        }
      }
    );

    return () => {
      appStateSubscription.remove();
      unsubscribe();
      controller.dispose();
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
    };
  }, [provider, queryClient, ship]);

  const openVerificationUrl = useCallback(async () => {
    if (browserOpenRef.current) return;
    const controller = controllerRef.current;
    const url = getLLMAuthVerificationUrl(
      flowFromState(state)?.verificationUrl
    );
    if (!url) {
      setBrowserError('The bot did not return a valid sign-in link.');
      return;
    }
    browserOpenRef.current = true;
    try {
      setBrowserError(null);
      if (provider === 'openai') {
        const result = await openOAuthUrl(url, null);
        if (controllerRef.current !== controller) return;
        logger.trackEvent('ChatGPT sign-in browser', { action: result.type });
        await controller?.resume();
      } else {
        await Linking.openURL(url);
      }
    } catch {
      logger.trackError('Could not open subscription sign-in', { provider });
      setBrowserError(
        'Could not open the sign-in page. Use the button below to try again.'
      );
    } finally {
      browserOpenRef.current = false;
    }
  }, [provider, state]);

  const start = useCallback(async () => {
    setBrowserError(null);
    const controller = controllerRef.current;
    if (!controller) return;
    logger.trackEvent('Subscription sign-in started', { provider });
    await controller.start();
  }, [provider]);

  const restart = useCallback(async () => {
    setBrowserError(null);
    await controllerRef.current?.retry();
  }, []);

  const completeToken = useCallback(async (token: string) => {
    return (await controllerRef.current?.complete(token)) ?? false;
  }, []);

  const dismiss = useCallback(() => {
    setBrowserError(null);
    controllerRef.current?.reset();
  }, []);

  return {
    state,
    browserError,
    start,
    restart,
    completeToken,
    dismiss,
    openVerificationUrl,
  };
}
