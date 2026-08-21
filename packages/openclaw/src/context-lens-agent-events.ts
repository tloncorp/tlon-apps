import type { OpenClawPluginApi } from 'openclaw/plugin-sdk/core';

import { normalizeContextLensActivityEvent } from './context-lens-activity.js';
import { publishContextLensEvent } from './context-lens-events.js';
import { recordContextLensActivityForRun } from './context-lens.js';
import { TLON_REQUEST_INPUT_EVENT_STREAM } from './tlon-request-input.js';

const ACTIVITY_STREAMS = [
  'lifecycle',
  'item',
  'plan',
  'tool',
  'approval',
  'command_output',
  'patch',
  'compaction',
  'error',
  // 7.1 emits this sanitized marker when a Codex app-server item finishes.
  // It lets us persist the final commentary phase without persisting deltas.
  'codex_app_server.item',
  // Explicit plugin-owned requester gate. OpenClaw 7.1 handles native Codex
  // user-input requests internally but does not expose them on its sanitized
  // host event streams, so the Tlon marker tool emits this scoped event.
  TLON_REQUEST_INPUT_EVENT_STREAM,
] as const;

/**
 * Subscribe to OpenClaw 2026.7.1's sanitized agent-event surface and attach
 * relevant events to active Context Lens runs. Raw thinking and assistant
 * deltas are intentionally not subscribed to. `item` preambles are the only
 * commentary eligible for the participant projection because they are
 * authored for the same conversation audience; tool/approval/error text
 * remains Lens-only even though Lens records it for the owner.
 */
export function registerContextLensAgentEvents(
  api: OpenClawPluginApi,
  enabled: boolean
): boolean {
  if (!enabled) {
    return false;
  }

  api.agent.events.registerAgentEventSubscription({
    id: 'tlon-context-lens-activity-v1',
    description:
      'Attach sanitized OpenClaw work activity to active Tlon Context Lens runs',
    streams: [...ACTIVITY_STREAMS],
    handle: (hostEvent) => {
      const activity = normalizeContextLensActivityEvent(hostEvent);
      if (!activity) {
        return;
      }
      const lens = recordContextLensActivityForRun(
        hostEvent.runId,
        hostEvent.sessionKey,
        activity
      );
      if (!lens) {
        return;
      }
      publishContextLensEvent('activity', lens, { activity });
    },
  });

  api.logger.info(
    `[tlon] Context Lens agent activity enabled (${ACTIVITY_STREAMS.join(', ')})`
  );
  return true;
}
