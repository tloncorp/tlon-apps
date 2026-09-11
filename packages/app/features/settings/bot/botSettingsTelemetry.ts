import { AnalyticsEvent, trackEvent } from '@tloncorp/shared';

export type TlonbotSettingUpdatedProperties = {
  setting:
    | 'api_key'
    | 'auto_accept_dm_invites'
    | 'auto_discover_channels'
    | 'channel_rules'
    | 'connected_service'
    | 'default_authorized_ships'
    | 'dm_allowlist'
    | 'fallback_models'
    | 'group_invite_allowlist'
    | 'nickname'
    | 'primary_model'
    | 'subscription'
    | 'zero_data_retention';
  action?: 'connected' | 'disconnected' | 'removed' | 'saved' | 'updated';
  count?: number;
  enabled?: boolean;
  model?: string;
  provider?: string;
};

/**
 * Capture a successfully persisted bot setting without sending user-authored
 * values such as nicknames, ship lists, or channel identifiers.
 */
export function trackTlonbotSettingUpdated(
  properties: TlonbotSettingUpdatedProperties
) {
  try {
    trackEvent(AnalyticsEvent.TlonbotSettingUpdated, {
      surface: 'bot_settings',
      ...Object.fromEntries(
        Object.entries(properties).filter(([, value]) => value !== undefined)
      ),
    });
  } catch {
    // Analytics is best-effort and must never turn a successful settings write
    // into a visible apply failure or leave the local draft uncommitted.
  }
}
