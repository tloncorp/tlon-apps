import type {
  PluginHookReplyPayloadSendingContext,
  PluginHookReplyPayloadSendingEvent,
  PluginHookReplyPayloadSendingResult,
} from 'openclaw/plugin-sdk/core';

export const TLON_FALLBACK_NOTICE_SUPPRESSION_REASON =
  'tlon_hides_model_fallback_status';

/**
 * Tlon users should receive the successful assistant answer, not OpenClaw's
 * provider-routing status message. The fallback lifecycle event remains
 * available to logs and telemetry, and terminal provider errors are ordinary
 * error payloads rather than fallback notices, so they continue to be sent.
 */
export function suppressTlonFallbackNotice(
  event: PluginHookReplyPayloadSendingEvent,
  ctx: PluginHookReplyPayloadSendingContext
): PluginHookReplyPayloadSendingResult | undefined {
  const channel = event.channel ?? ctx.channelId;
  if (channel !== 'tlon' || event.payload.isFallbackNotice !== true) {
    return undefined;
  }

  return {
    cancel: true,
    reason: TLON_FALLBACK_NOTICE_SUPPRESSION_REASON,
  };
}
