import * as api from '@tloncorp/api';

import type { BotConfig } from '../domain/botConfig';

const BOT_CONFIG_KEY = 'tlonbotConfig';

export async function saveBotConfig(config: BotConfig): Promise<void> {
  await api.setSetting(BOT_CONFIG_KEY, JSON.stringify(config));
}
