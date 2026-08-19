import { parseGroupKitConfig as parseSharedGroupKitConfig } from '@tloncorp/tlon-kits';

import { createDevLogger } from '../lib/logger';

export type {
  GroupKitConfig,
  GroupKitEntry,
  GroupKitSchedule,
} from '@tloncorp/tlon-kits';

const logger = createDevLogger('groupKitConfig', false);

/**
 * Parse a group's blob into its kit install config. The implementation lives
 * in @tloncorp/tlon-kits so the client and the OpenClaw harness read the same
 * payload the same way; see kits/SCHEMA.md §2 for the format.
 */
export function parseGroupKitConfig(blob: string | null | undefined) {
  return parseSharedGroupKitConfig(blob, {
    log: (message) => logger.log(message),
  });
}
