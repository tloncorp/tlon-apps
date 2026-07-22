import {
  AnalyticsEvent,
  createDevLogger,
  trackProductEvent,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { Button, useCopy } from '@tloncorp/ui';
import { useCallback } from 'react';
import { Share } from 'react-native';
import { XStack, YStack, isWeb } from 'tamagui';

import { TextInput } from './Form';

const logger = createDevLogger('PersonalInviteButton', true);

export function PersonalInviteButton() {
  const inviteLink = db.personalInviteLink.useValue();
  const isLoading = !inviteLink;
  const { doCopy, didCopy } = useCopy(inviteLink ?? '');

  const trackInviteShared = useCallback(() => {
    if (!inviteLink) return;

    logger.trackEvent(AnalyticsEvent.InviteShared, {
      inviteId: inviteLink.split('/').pop() ?? null,
      inviteType: 'user',
    });
  }, [inviteLink]);

  const handleCopyInviteLink = useCallback(async () => {
    if (isLoading || !inviteLink) return;

    await doCopy();
    trackInviteShared();
    trackProductEvent(AnalyticsEvent.InviteShareCompleted, {
      inviteType: 'personal',
      method: 'copy',
      source: 'invite_surface',
    });
  }, [doCopy, inviteLink, isLoading, trackInviteShared]);

  const handleShareInviteLink = useCallback(async () => {
    if (isLoading || !inviteLink) return;

    try {
      let method: 'copy' | 'native_share' = 'native_share';
      if (isWeb) {
        if (typeof navigator.share === 'function') {
          await navigator.share({ url: inviteLink });
        } else {
          await doCopy();
          method = 'copy';
        }
      } else {
        const result = await Share.share({
          message: inviteLink,
        });

        if (result.action !== Share.sharedAction) return;
      }

      trackInviteShared();
      trackProductEvent(AnalyticsEvent.InviteShareCompleted, {
        inviteType: 'personal',
        method,
        source: 'invite_surface',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  }, [doCopy, inviteLink, isLoading, trackInviteShared]);

  return (
    <YStack width="100%" gap="$s">
      <XStack width="100%">
        <TextInput
          value={inviteLink ?? ''}
          placeholder="Preparing invite link"
          accent="positive"
          editable={false}
          selectTextOnFocus={!isLoading}
          frameStyle={{
            flex: 1,
            height: 44,
            borderTopRightRadius: 0,
            borderBottomRightRadius: 0,
            borderRightWidth: 0,
          }}
        />
        <Button
          intent="positive"
          size="small"
          width={44}
          borderTopLeftRadius={0}
          borderBottomLeftRadius={0}
          icon={didCopy ? 'Checkmark' : 'Copy'}
          accessibilityLabel={didCopy ? 'Copied' : 'Copy invite link'}
          loading={isLoading}
          disabled={isLoading}
          onPress={handleCopyInviteLink}
        />
      </XStack>
      <Button
        intent="positive"
        fill="outline"
        size="small"
        label="Share link"
        leadingIcon="Send"
        disabled={isLoading}
        onPress={handleShareInviteLink}
      />
    </YStack>
  );
}
