import * as api from '@tloncorp/api';
import { createDevLogger } from '@tloncorp/shared';
import { withRetry } from '@tloncorp/shared/logic';

import { validateProviderKey } from './providerKeyValidation';

const logger = createDevLogger('botModelSetup', false);

const RETRY = { startingDelay: 750, numOfAttempts: 4, maxDelay: 4000 };

/**
 * Point the bot at a model and wait for it to come back up. The bot restarts
 * to pick up the change, so this resolves once it is running again, or false
 * if it isn't within 30 seconds.
 */
export async function applyBotPrimaryModel({
  userId,
  shipId,
  provider,
  model,
}: {
  userId: string | null;
  shipId: string | null;
  provider: string;
  model: string;
}): Promise<boolean> {
  const meta = { provider, model };
  logger.trackEvent('Wayfinding Bot Reconfigure Started', meta);

  if (!userId || !shipId) {
    logger.trackError('Wayfinding Bot Reconfigure Failed', {
      ...meta,
      step: 'missing_ids',
      hasUserId: !!userId,
      hasShipId: !!shipId,
    });
    return false;
  }

  try {
    await withRetry(
      () => api.setTlawnPrimaryModel(userId, { provider, model }),
      RETRY
    );
    logger.trackEvent('Wayfinding Bot Primary Model Sync Succeeded', meta);
  } catch (error) {
    logger.trackError('Wayfinding Bot Reconfigure Failed', {
      ...meta,
      step: 'set_primary_model',
      error,
    });
    return false;
  }

  const running = await api.awaitBotRunning(shipId, {
    timeoutMs: 30_000,
    pollIntervalMs: 1500,
  });
  if (running) {
    logger.trackEvent('Wayfinding Bot Reconfigure Ready', meta);
    return true;
  }
  logger.trackError('Wayfinding Bot Reconfigure Failed', {
    ...meta,
    step: 'await_bot_running_timeout',
  });
  return false;
}

export class ProviderKeyError extends Error {}

/**
 * Save someone's own API key and list the models it can reach, which is also
 * how the key is checked. Throws a `ProviderKeyError` with words to show.
 */
export async function saveProviderKeyAndListModels({
  userId,
  provider,
  apiKey,
}: {
  userId: string;
  provider: string;
  apiKey: string;
}): Promise<api.TlawnProviderModel[]> {
  const formatError = validateProviderKey(provider, apiKey);
  if (formatError) throw new ProviderKeyError(formatError);
  try {
    await api.setTlawnProviderKey(userId, provider, apiKey);
    const result = await api.getTlawnProviderModels(userId, provider);
    if (!result.data.length) {
      throw new ProviderKeyError(
        'We could not load models for this API key. Please try again.'
      );
    }
    return result.data;
  } catch (error) {
    if (error instanceof ProviderKeyError) throw error;
    logger.trackError('Wayfinding Bot Provider Validation Failed', {
      provider,
      error,
    });
    throw new ProviderKeyError(
      'Could not check this key. Check it and try again.'
    );
  }
}
