import { useQueryClient } from '@tanstack/react-query';
import * as api from '@tloncorp/api';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';

import {
  OpenAIAuthState,
  getLLMAuthVerificationUrl,
} from './openAiSubscription';
import { OpenAIAuthController } from './openAiSubscriptionController';
import { trackTlonbotSettingUpdated } from './botSettingsTelemetry';

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
    const unsubscribe = controller.subscribe(setState);
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
    const url = getLLMAuthVerificationUrl(
      flowFromState(state)?.verificationUrl
    );
    if (!url) {
      setBrowserError('The bot did not return a valid sign-in link.');
      return;
    }
    try {
      await Linking.openURL(url);
      setBrowserError(null);
    } catch {
      setBrowserError(
        'Could not open the sign-in page. Use the button below to try again.'
      );
    }
  }, [state]);

  const start = useCallback(async () => {
    setBrowserError(null);
    const controller = controllerRef.current;
    if (!controller) return;
    await controller.start();
  }, []);

  const restart = useCallback(async () => {
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
