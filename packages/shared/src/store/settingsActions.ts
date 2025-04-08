import { setSetting } from '../api';
import * as db from '../db';
import { createDevLogger } from '../debug';
import { AnalyticsEvent } from '../domain';
import * as logic from '../logic';
import { withRetry } from '../logic';
import { TalkSidebarFilter } from '../urbit';

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

export async function completeWayfindingSplash() {
  // optimistic update
  await db.insertSettings({ completedWayfindingSplash: true });
  try {
    await withRetry(() => setSetting('completedWayfindingSplash', true));
  } catch (e) {
    logger.trackEvent(AnalyticsEvent.WayfindingDebug, {
      context: 'failed to mark remote setting completed',
      settingName: 'completedWayfindingSplash',
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
    });

    // don't rollback the optimistic update, we want to avoid showing
    // the splash sequence again
  }
}

export async function checkWayfindingChannelVisited(channelId: string) {
  if (logic.isPersonalChatChannel(channelId)) {
    await db.wayfindingProgress.setValue((prev) => ({
      ...prev,
      viewedChatChannel: true,
    }));
  } else if (logic.isPersonalCollectionChannel(channelId)) {
    await db.wayfindingProgress.setValue((prev) => ({
      ...prev,
      viewedCollectionChannel: true,
    }));
  } else if (logic.isPersonalNotebookChannel(channelId)) {
    await db.wayfindingProgress.setValue((prev) => ({
      ...prev,
      viewedNotebookChannel: true,
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
