import * as api from '@tloncorp/shared/api';
import { useCallback } from 'react';

import { OPENROUTER_API_KEY } from '../lib/envVars';

/**
 * Hook that provides OpenRouter API functionality with automatic API key injection
 */
export function useOpenRouterApi() {
  const summarizeMessage = useCallback(
    async (messageText: string) => {
      return api.summarizeMessage({
        messageText,
        apiKey: OPENROUTER_API_KEY,
      });
    },
    []
  );

  return {
    summarizeMessage,
    isConfigured: !!OPENROUTER_API_KEY,
  };
}
