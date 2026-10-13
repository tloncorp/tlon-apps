import * as db from '@tloncorp/shared/db';

/**
 * Reads what the bot card needs from local storage ahead of time. Called above
 * the tabs, so the Settings tab can draw the card on its first frame instead
 * of after its own storage reads.
 */
export function useWarmBotSettingsCard() {
  db.hostingBotEnabled.useValue();
  db.botSettingsSummary.useValue();
}
