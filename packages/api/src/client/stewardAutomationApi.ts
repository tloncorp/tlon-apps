import type { StewardAutomationTasks } from '../urbit/stewardAutomation';
import { scry } from './urbit';

/**
 * Read Steward's best-effort mirror of OpenClaw cron definitions.
 * OpenClaw remains authoritative; this endpoint intentionally has no mutation
 * or runtime-status surface.
 */
export function getStewardAutomationTasks() {
  return scry<StewardAutomationTasks>({
    app: 'steward',
    path: '/v1/automation/tasks',
  });
}
