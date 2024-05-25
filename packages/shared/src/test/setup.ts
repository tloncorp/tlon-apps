import dotenv from 'dotenv';
import { vi } from 'vitest';

import { addCustomEnabledLoggers } from '../debug';

dotenv.config({ path: __dirname + '/../../.env.test' });
const loggers = process.env.ENABLED_LOGGERS?.split(',') ?? [];

addCustomEnabledLoggers(loggers);

export function mockUrbit() {
  vi.mock('../api/urbit', async () => {
    return {
      scry: vi.fn(),
      getCurrentUserId: () => '~solfer-magfed',
    };
  });
}
