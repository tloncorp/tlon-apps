import { AnalyticsEvent, createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { useCopy } from '@tloncorp/ui';
import { useCallback } from 'react';
import { Share } from 'react-native';
import { isWeb } from 'tamagui';

const logger = createDevLogger('useShareInviteLink', true);

/**
 * Sharing and copying your personal invite link, counted as an invite shared
 * once it is sent or copied. The link is null until it has been made.
 */
export function useShareInviteLink() {
  const inviteLink = db.personalInviteLink.useValue();
  const { doCopy, didCopy } = useCopy(inviteLink ?? '');

  const trackInviteShared = useCallback(() => {
    if (!inviteLink) return;
    logger.trackEvent(AnalyticsEvent.InviteShared, {
      inviteId: inviteLink.split('/').pop() ?? null,
      inviteType: 'user',
    });
  }, [inviteLink]);

  const copy = useCallback(async () => {
    if (!inviteLink) return false;
    await doCopy();
    trackInviteShared();
    return true;
  }, [doCopy, inviteLink, trackInviteShared]);

  /** Opens the share sheet, or copies where the browser has none. */
  const share = useCallback(async (): Promise<'shared' | 'copied' | null> => {
    if (!inviteLink) return null;
    try {
      if (isWeb) {
        if (typeof navigator.share === 'function') {
          await navigator.share({ url: inviteLink });
        } else {
          await doCopy();
          trackInviteShared();
          return 'copied';
        }
      } else {
        const result = await Share.share({ message: inviteLink });
        if (result.action !== Share.sharedAction) return null;
      }
      trackInviteShared();
      return 'shared';
    } catch (error) {
      console.error('Error sharing:', error);
      return null;
    }
  }, [doCopy, inviteLink, trackInviteShared]);

  return { inviteLink, didCopy, copy, share };
}
