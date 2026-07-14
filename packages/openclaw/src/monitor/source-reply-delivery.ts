import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';

export type TlonSourceReplyDeliveryMode = 'automatic' | undefined;

/**
 * Tlon owns delivery for inbound source turns, so normal assistant finals
 * should be visible unless the operator explicitly configured otherwise.
 * Group-only policy must not make direct-message finals private.
 */
export function resolveTlonSourceReplyDeliveryMode(params: {
  isGroup: boolean;
  messages?: OpenClawConfig['messages'];
}): TlonSourceReplyDeliveryMode {
  const hasExplicitPolicy =
    params.messages?.visibleReplies !== undefined ||
    (params.isGroup &&
      params.messages?.groupChat?.visibleReplies !== undefined);

  return hasExplicitPolicy ? undefined : 'automatic';
}
