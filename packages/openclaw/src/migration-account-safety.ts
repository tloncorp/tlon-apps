import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';

import { getAllBridges } from './monitor/command-bridge.js';
import { listRunnableTlonAccountIds } from './types.js';

/**
 * Migration uses process-global Tlon API state, so it is unsafe whenever
 * either durable configuration or transient bridge registration identifies
 * more than one runnable account.
 *
 * Zero configured accounts is valid: the CLI can rely on environment
 * credentials while a single monitor bridge supplies command routing.
 */
export function hasAmbiguousMigrationAccount(cfg: OpenClawConfig): boolean {
  return listRunnableTlonAccountIds(cfg).length > 1 || getAllBridges().size > 1;
}
