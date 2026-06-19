import {
  type ChannelOutboundSessionRouteParams,
  buildChannelOutboundSessionRoute,
} from 'openclaw/plugin-sdk/core';

import { parseTlonTarget } from './targets.js';

/**
 * Channel-native outbound session-route builder for Tlon (Phase 4).
 *
 * Lets explicit outbound sends to a Tlon target (e.g. the shared `message` tool
 * with `to: tlon:~ship`) derive a stable Tlon session route, so they resolve
 * to Tlon even when the current turn's surface is something else. Returns
 * `null` for non-Tlon / unparseable targets so core can fall through.
 */
export function resolveTlonOutboundSessionRoute(
  params: ChannelOutboundSessionRouteParams
) {
  const parsed = parseTlonTarget(params.target);
  if (!parsed) {
    return null;
  }

  const threadId =
    params.threadId != null && params.threadId !== ''
      ? params.threadId
      : undefined;

  if (parsed.kind === 'dm') {
    return buildChannelOutboundSessionRoute({
      cfg: params.cfg,
      agentId: params.agentId,
      channel: 'tlon',
      accountId: params.accountId,
      peer: { kind: 'direct', id: parsed.ship },
      chatType: 'direct',
      from: `tlon:${parsed.ship}`,
      to: `tlon:${parsed.ship}`,
      ...(threadId !== undefined ? { threadId } : {}),
    });
  }

  return buildChannelOutboundSessionRoute({
    cfg: params.cfg,
    agentId: params.agentId,
    channel: 'tlon',
    accountId: params.accountId,
    peer: { kind: 'group', id: parsed.nest },
    chatType: 'group',
    from: `tlon:group:${parsed.nest}`,
    to: `tlon:${parsed.nest}`,
    ...(threadId !== undefined ? { threadId } : {}),
  });
}
