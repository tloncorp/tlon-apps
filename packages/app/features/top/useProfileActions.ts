import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { triggerHaptic, useCopy, useToast } from '@tloncorp/ui';
import { useCallback, useMemo } from 'react';
import { Share } from 'react-native';
import { isWeb } from 'tamagui';

import type { ProfileActions } from '../../ui';

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
  onCopyId: () => void;
  onClearSuggestion: () => void;
} {
  const { data: contact } = store.useContact({ id: userId });
  const { data: dmChannel } = store.useChannel({ id: userId });
  const { data: volume } = store.useChannelVolumeLevel(userId);
  const baseVolume = store.useBaseVolumeLevel();
  const inviteLink = db.personalInviteLink.useValue();
  const { doCopy } = useCopy(userId);
  const showToast = useToast();

  const isBlocked = contact?.isBlocked ?? false;
  const isContact = contact?.isContact ?? false;
  const isContactSuggestion = contact?.isContactSuggestion ?? false;
  const isMuted = volume === 'hush';

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

  const handleToggleMute = useCallback(() => {
    if (!dmChannel) {
      return;
    }
    // Clearing the override unmutes only when the default isn't muted too;
    // otherwise the DM needs a level of its own.
    const unmutedLevel = baseVolume === 'hush' ? 'medium' : null;
    store.setChannelVolumeLevel({
      channel: dmChannel,
      level: isMuted ? unmutedLevel : 'hush',
    });
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

  const shareText = isOwnProfile ? inviteLink : userId;
  const { doCopy: copyShareText } = useCopy(shareText ?? '');
  const handleShare = useCallback(async () => {
    if (!shareText) {
      return;
    }
    try {
      if (isWeb) {
        if (typeof navigator.share === 'function') {
          await navigator.share(
            isOwnProfile ? { url: shareText } : { text: shareText }
          );
        } else {
          copyShareText();
          triggerHaptic('success');
          showToast({ message: 'Copied!', duration: 1500 });
        }
        return;
      }
      await Share.share({ message: shareText });
    } catch (error) {
      console.error('Error sharing profile:', error);
    }
  }, [copyShareText, isOwnProfile, shareText, showToast]);

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
      isBlocked,
      isContact,
      isContactSuggestion,
      isMuted,
    ]
  );
}
