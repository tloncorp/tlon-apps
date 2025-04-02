import { createDevLogger, withRetry } from '@tloncorp/shared';
import * as api from '@tloncorp/shared/api';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useEffect, useRef } from 'react';

const logger = createDevLogger('myNewLogger', true);

function stubPredicate(): boolean {
  // TODO: how do we determine who gets one?
  return true;
}

export function usePersonalGroup() {
  const session = store.useCurrentSession();
  const lockRef = useRef(false);

  useEffect(() => {
    async function runScaffold() {
      console.log('bl: running scaffoldPersonalGroup');
      if (lockRef.current) {
        logger.trackEvent('Locked, skipping');
        return;
      }

      try {
        lockRef.current = true;

        const currentUserId = api.getCurrentUserId();
        const PERSONAL_GROUP = store.getPersonalGroupDetails(currentUserId);
        const personalGroupId = `${currentUserId}/${PERSONAL_GROUP.slug}`;
        const group = await db.getGroup({ id: personalGroupId });
        const chatChannel = group?.channels.find(
          (chan) => chan.id === PERSONAL_GROUP.chatChannelId
        );
        const collectionChannel = group?.channels.find(
          (chan) => chan.id === PERSONAL_GROUP.collectionChannelId
        );
        const notesChannel = group?.channels.find(
          (chan) => chan.id === PERSONAL_GROUP.notebookChannelId
        );

        const alreadyHasPersonalGroup =
          group && chatChannel && collectionChannel && notesChannel;
        const userShouldHavePersonalGroup = stubPredicate();

        if (!alreadyHasPersonalGroup && userShouldHavePersonalGroup) {
          logger.trackEvent('Detected Needs Personal Group');
          await withRetry(async () => await store.scaffoldPersonalGroup());
        } else {
          if (alreadyHasPersonalGroup) {
            logger.trackEvent('Detected Personal Group');
          }
          if (!userShouldHavePersonalGroup) {
            logger.trackEvent('Detected No Personal Group Needed');
          }
        }
      } finally {
        lockRef.current = false;
      }
    }

    const connectionReady =
      session?.startTime && session.channelStatus === 'active';
    if (connectionReady) {
      runScaffold();
    } else {
      console.log('skipping', session?.channelStatus);
    }
  }, [session]);
}
