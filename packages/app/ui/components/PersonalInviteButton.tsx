import { AnalyticsEvent, createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { Button, triggerHaptic, useCopy } from '@tloncorp/ui';
import { useCallback } from 'react';
import { Share } from 'react-native';
import { isWeb } from 'tamagui';

const logger = createDevLogger('PersonalInviteButton', true);

export function PersonalInviteButton() {
  const inviteLink = db.personalInviteLink.useValue();
  const isLoading = !inviteLink;
  const { doCopy, didCopy } = useCopy(inviteLink ?? '');

  const handleInviteButtonPress = useCallback(async () => {
    if (isLoading || !inviteLink) return;

    if (isWeb) {
      doCopy();
      return;
    }

    try {
      triggerHaptic('baseButtonClick');
      const result = await Share.share({ message: inviteLink });

      if (result.action === Share.sharedAction) {
        logger.trackEvent(AnalyticsEvent.InviteShared, {
          inviteId: inviteLink.split('/').pop() ?? null,
          inviteType: 'user',
        });
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
  }, [doCopy, inviteLink, isLoading]);

  return (
    <Button
      onPress={handleInviteButtonPress}
      loading={isLoading}
      disabled={isLoading}
      label={
        isLoading
          ? 'Preparing invite link'
          : didCopy
            ? 'Copied'
            : 'Share invite link'
      }
      leadingIcon={isLoading ? undefined : didCopy ? 'Checkmark' : 'Link'}
      preset="hero"
    />
  );
}
