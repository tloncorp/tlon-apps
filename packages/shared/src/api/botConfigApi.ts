import * as api from '@tloncorp/api';

import * as db from '../db';
import type { BotConfig } from '../domain/botConfig';
import { DEFAULT_BOT_CONFIG } from '../domain/botConfig';

const LOCAL_CONFIG_KEY = 'tlonbotConfig';

// Provider name used by the hosted bot API for each model option
const MODEL_TO_PROVIDER: Record<string, string> = {
  minimax: 'basic',
  anthropic: 'anthropic',
  openai: 'openai',
  openrouter: 'openrouter',
};

// Default model identifiers per provider on the hosted bot API
const PROVIDER_DEFAULT_MODEL: Record<string, string> = {
  basic: 'minimax/minimax-m2.5',
  anthropic: 'anthropic/claude-haiku-4-5-20251001',
  openai: 'openai/gpt-4o-mini',
  openrouter: 'openrouter/auto',
};

async function getAuthCookie(): Promise<string> {
  const token = await db.hostingAuthToken.getValue();
  if (!token) {
    throw new Error('Not authenticated with hosting');
  }
  return token;
}

/**
 * Save bot config. Sends provider keys, primary model, and nickname to the
 * hosted bot hosting API, then persists the full config locally for fields that
 * have no remote endpoint (emoji, personality, response style, active hours).
 */
export async function saveBotConfig(config: BotConfig): Promise<void> {
  // Persist full config locally so the UI can reload it (best-effort —
  // the Urbit client may not be initialized yet during onboarding)
  try {
    await api.setSetting(LOCAL_CONFIG_KEY, JSON.stringify(config));
  } catch {
    // Client not ready; hosting API calls below will still run
  }

  // Attempt to sync remote-backed fields to the hosting API
  const userId = await db.hostingUserId.getValue();
  const shipId = await db.hostedUserNodeId.getValue();
  if (!userId || !shipId) {
    return;
  }

  let authCookie: string;
  try {
    authCookie = await getAuthCookie();
  } catch {
    return;
  }

  const provider = MODEL_TO_PROVIDER[config.model] ?? 'basic';
  const model = PROVIDER_DEFAULT_MODEL[provider] ?? PROVIDER_DEFAULT_MODEL.basic;

  const results = await Promise.allSettled([
    // Set provider key if user provided one
    config.apiKey
      ? api.setProviderKey(userId, authCookie, provider, config.apiKey)
      : Promise.resolve(),

    // Set primary model
    api.setPrimaryModel(userId, authCookie, { provider, model }),

    // Set bot nickname
    config.name
      ? api.setBotNickname(shipId, authCookie, config.name)
      : Promise.resolve(),
  ]);

  for (const result of results) {
    if (result.status === 'rejected') {
      console.warn('hosted bot API call failed during bot config save:', result.reason);
    }
  }
}

/**
 * Load bot config from local settings.
 */
export async function loadBotConfig(): Promise<BotConfig> {
  try {
    const raw = await api.getSettingValue(LOCAL_CONFIG_KEY);
    if (raw) {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return { ...DEFAULT_BOT_CONFIG, ...parsed };
    }
  } catch {
    // Fall through to default
  }
  return { ...DEFAULT_BOT_CONFIG };
}
