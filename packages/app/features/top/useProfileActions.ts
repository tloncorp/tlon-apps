import { AnalyticsEvent, trackEvent } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { triggerHaptic, useCopy, useToast } from '@tloncorp/ui';
import { useCallback, useMemo } from 'react';
import { Share } from 'react-native';
import { isWeb } from 'tamagui';

import type { ProfileActions } from '../../ui';
import { useShareInviteLink } from '../../ui/hooks/useShareInviteLink';

/**
 * What a profile's action circles and ⋯ menu can do. Your own profile shares
 * your invite link; nobody else has a link, so theirs shares the @p.
 */
export function useProfileActions({
  userId,
  isOwnProfile,
  onMessage,
}: {
  userId: string;
  isOwnProfile: boolean;
  onMessage: (userId: string) => void;
}): ProfileActions & {
  isContactSuggestion: boolean;
  /** False on your own profile until your invite link has been made. */
  canShare: boolean;
  onCopyId: () => void;
  onClearSuggestion: () => void;
} {
  const { data: contact } = store.useContact({ id: userId });
  const { data: dmChannel } = store.useChannel({ id: userId });
  const { data: volume } = store.useChannelVolumeLevel(userId);
  const baseVolume = store.useBaseVolumeLevel();
  const invite = useShareInviteLink();
  const { doCopy } = useCopy(userId);
  const showToast = useToast();

  const isBlocked = contact?.isBlocked ?? false;
  const isContact = contact?.isContact ?? false;
  const isContactSuggestion = contact?.isContactSuggestion ?? false;
  // A DM with no level of its own follows the default, as on the volume
  // screen.
  const isMuted =
    (!volume || volume === 'default' ? baseVolume : volume) === 'hush';

  const handleMessage = useCallback(() => {
    if (!isBlocked) {
      onMessage(userId);
    }
  }, [isBlocked, onMessage, userId]);

  const handleToggleContact = useCallback(() => {
    if (isContact) {
      store.removeContact(userId);
    } else {
      store.addContact(userId);
    }
  }, [isContact, userId]);

  // Tracked like a change from the chat sheet. The action rolls back and
  // reports its own failures, returning false.
  const handleToggleMute = useCallback(async () => {
    if (!dmChannel) {
      return;
    }
    // Clearing the override unmutes only when the default isn't muted too;
    // otherwise the DM needs a level of its own.
    const unmutedLevel = baseVolume === 'hush' ? 'medium' : null;
    const level = isMuted ? unmutedLevel : 'hush';
    if (await store.setChannelVolumeLevel({ channel: dmChannel, level })) {
      trackEvent(AnalyticsEvent.NotificationLevelChanged, {
        level: level ?? 'default',
      });
    }
  }, [baseVolume, dmChannel, isMuted]);

  const handleToggleBlock = useCallback(async () => {
    if (isBlocked) {
      await store.unblockUser(userId);
    } else {
      await store.blockUser(userId);
    }
    db.queryClient.invalidateQueries({ queryKey: [['contact', userId]] });
  }, [isBlocked, userId]);

  const handleCopyId = useCallback(() => {
    doCopy();
    triggerHaptic('success');
    showToast({ message: 'Copied!', duration: 1500 });
  }, [doCopy, showToast]);

  // Your own profile shares your invite link, counted as an invite shared.
  // Nobody else has a link, so theirs shares the @p.
  const { share: shareInvite } = invite;
  const handleShare = useCallback(async () => {
    if (isOwnProfile) {
      if ((await shareInvite()) === 'copied') {
        triggerHaptic('success');
        showToast({ message: 'Copied!', duration: 1500 });
      }
      return;
    }
    try {
      if (isWeb) {
        if (typeof navigator.share === 'function') {
          await navigator.share({ text: userId });
        } else {
          doCopy();
          triggerHaptic('success');
          showToast({ message: 'Copied!', duration: 1500 });
        }
        return;
      }
      await Share.share({ message: userId });
    } catch (error) {
      console.error('Error sharing profile:', error);
    }
  }, [doCopy, isOwnProfile, shareInvite, showToast, userId]);

  const handleClearSuggestion = useCallback(() => {
    store.removeContactSuggestion(userId);
  }, [userId]);

  return useMemo(
    () => ({
      isBlocked,
      isContact,
      isContactSuggestion,
      isMuted,
      canMute: !!dmChannel,
      canShare: !isOwnProfile || !!invite.inviteLink,
      onMessage: handleMessage,
      onToggleContact: handleToggleContact,
      onToggleMute: handleToggleMute,
      onToggleBlock: handleToggleBlock,
      onShare: handleShare,
      onCopyId: handleCopyId,
      onClearSuggestion: handleClearSuggestion,
    }),
    [
      dmChannel,
      handleClearSuggestion,
      handleCopyId,
      handleMessage,
      handleShare,
      handleToggleBlock,
      handleToggleContact,
      handleToggleMute,
      invite.inviteLink,
      isBlocked,
      isContact,
      isContactSuggestion,
      isMuted,
      isOwnProfile,
    ]
  );
}
