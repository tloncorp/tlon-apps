import type { AnyAgentTool, OpenClawPluginApi } from 'openclaw/plugin-sdk/core';

import {
  TLON_REQUEST_INPUT_TOOL_NAME,
  createTlonRequestInputTool,
} from './tlon-request-input.js';

export const TLON_AGENT_TOOL_NAMES = [
  'tlon',
  TLON_REQUEST_INPUT_TOOL_NAME,
] as const;

/**
 * Register Tlon's agent tools as one atomic plugin-registry entry.
 *
 * OpenClaw 7.1 resolves plugin tool entries sequentially. Once the `tlon`
 * tool is resolved, its name collides with the plugin id during the next
 * entry's preflight and that later entry is skipped. A single array factory
 * avoids that host bug and ensures the requester-input marker reaches the
 * effective Codex tool catalog. Factory registrations must declare names.
 */
export function registerTlonAgentTools(
  api: Pick<OpenClawPluginApi, 'registerTool'>,
  tlonTool: AnyAgentTool
): void {
  api.registerTool(() => [tlonTool, createTlonRequestInputTool()], {
    names: [...TLON_AGENT_TOOL_NAMES],
  });
}
