import { ThemeName } from 'tamagui';

import { setSetting } from '../api';
import * as db from '../db';
import { createDevLogger } from '../debug';
import { AnalyticsEvent, AnalyticsSeverity } from '../domain';
import * as logic from '../logic';
import { withRetry } from '../logic';
import { TalkSidebarFilter } from '../urbit';

export type AppTheme = ThemeName | 'auto';

const logger = createDevLogger('SettingsActions', false);

export async function changeMessageFilter(filter: TalkSidebarFilter) {
  const existing = await db.getSettings();
  const oldFilter = existing?.messagesFilter;
  try {
    // optimistic update
    await db.insertSettings({ messagesFilter: filter });
    return setSetting('messagesFilter', filter);
  } catch (e) {
    console.error('Failed to change message filter', e);
    await db.insertSettings({ messagesFilter: oldFilter });
  }
}

export async function updateCalmSetting(
  calmKey: 'disableNicknames' | 'disableAvatars',
  value: boolean
) {
  const existing = await db.getSettings();
  const oldValue = existing?.[calmKey];

  try {
    // optimistic update
    await db.insertSettings({ [calmKey]: value });

    await setSetting(calmKey, value);
    logger.trackEvent(AnalyticsEvent.ActionCalmSettingsUpdate, {
      calmKey,
      value,
    });
  } catch (error) {
    logger.trackEvent(AnalyticsEvent.ErrorCalmSettingsUpdate, {
      calmKey,
      value,
      severity: AnalyticsSeverity.Medium,
      errorMessage: error.message,
      errorStack: error.stack,
    });
    // rollback optimistic update
    await db.insertSettings({ [calmKey]: oldValue });
    throw new Error('Failed to update calm setting');
  }
}

export async function completeWayfindingSplash() {
  // optimistic update
  await db.insertSettings({ completedWayfindingSplash: true });
  try {
    await withRetry(() => setSetting('completedWayfindingSplash', true));
  } catch (e) {
    logger.trackEvent(AnalyticsEvent.WayfindingDebug, {
      context: 'failed to mark remote setting completed',
      settingName: 'completedWayfindingSplash',
      severity: AnalyticsSeverity.High,
    });

    // don't rollback the optimistic update, we want to avoid showing
    // the splash sequence again
  }
}

export async function completeWayfindingTutorial() {
  // optimistic update
  await db.insertSettings({ completedWayfindingTutorial: true });
  try {
    await withRetry(() => setSetting('completedWayfindingTutorial', true));
  } catch (e) {
    logger.trackEvent(AnalyticsEvent.WayfindingDebug, {
      context: 'failed to mark remote setting completed',
      settingName: 'completedWayfindingTutorial',
      severity: AnalyticsSeverity.High,
    });

    // don't rollback the optimistic update, we want to avoid showing
    // the splash sequence again
  }
}

export async function markPotentialWayfindingChannelVisit(channelId: string) {
  if (logic.isPersonalChatChannel(channelId)) {
    await db.wayfindingProgress.setValue((prev) => ({
      ...prev,
      viewedChatChannel: true,
      viewedPersonalGroup: true,
    }));
  } else if (logic.isPersonalCollectionChannel(channelId)) {
    await db.wayfindingProgress.setValue((prev) => ({
      ...prev,
      viewedCollectionChannel: true,
      viewedPersonalGroup: true,
    }));
  } else if (logic.isPersonalNotebookChannel(channelId)) {
    await db.wayfindingProgress.setValue((prev) => ({
      ...prev,
      viewedNotebookChannel: true,
      viewedPersonalGroup: true,
    }));
  }

  const updatedProgress = await db.wayfindingProgress.getValue();
  const settings = await db.getSettings();

  const visitedAllChannels =
    updatedProgress.viewedChatChannel &&
    updatedProgress.viewedCollectionChannel &&
    updatedProgress.viewedNotebookChannel;

  const alreadyCompletedTutorial = settings?.completedWayfindingTutorial;

  if (visitedAllChannels && !alreadyCompletedTutorial) {
    await completeWayfindingTutorial();
  }
}

export async function updateTheme(theme: AppTheme) {
  const existing = await db.getSettings();
  const oldTheme = existing?.theme;

  try {
    const dbTheme = theme === 'auto' ? null : theme;
    await db.insertSettings({ theme: dbTheme });
    await setSetting('theme', theme === 'auto' ? '' : theme);
    logger.trackEvent(AnalyticsEvent.ActionThemeUpdate, {
      theme: theme === 'auto' ? 'auto' : theme,
    });
  } catch (error) {
    logger.trackError(AnalyticsEvent.ErrorThemeUpdate, {
      theme,
      severity: AnalyticsSeverity.Medium,
      errorMessage: error.message,
      errorStack: error.stack,
    });
    await db.insertSettings({ theme: oldTheme });
    throw new Error('Failed to update theme setting');
  }
}

export async function updateDisableTlonInfraEnhancement(disabled: boolean) {
  const existing = await db.getSettings();
  const oldValue = existing?.disableTlonInfraEnhancement;

  try {
    // optimistic update
    await db.insertSettings({ disableTlonInfraEnhancement: disabled });
    await setSetting('disableTlonInfraEnhancement', disabled);
  } catch (e) {
    logger.trackError('Error updating disable tlon infra setting', {
      disabled,
      severity: AnalyticsSeverity.Medium,
      errorMessage: e.message,
      errorStack: e.stack,
    });
    await db.insertSettings({ disableTlonInfraEnhancement: oldValue });
  }
}

export async function updateLogActivity(value: boolean) {
  const existing = await db.getSettings();
  const oldValue = existing?.logActivity;

  try {
    // optimistic update
    await db.insertSettings({ logActivity: value });
    await setSetting('logActivity', value);
  } catch (e) {
    logger.trackError('Error updating log activity setting', {
      value,
      severity: AnalyticsSeverity.Medium,
      errorMessage: e.message,
      errorStack: e.stack,
    });
    await db.insertSettings({ logActivity: oldValue });
  }
}
