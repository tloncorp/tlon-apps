import { AnalyticsEvent, createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { Button, Icon, Text, useCopy } from '@tloncorp/ui';
import { useCallback, useMemo } from 'react';
import { Share } from 'react-native';
import { YStack, isWeb } from 'tamagui';

const logger = createDevLogger('PersonalInviteButton', true);

export function PersonalInviteButton() {
  const inviteLink = db.personalInviteLink.useValue();
  const isLoading = !inviteLink;
  const { doCopy, didCopy } = useCopy(inviteLink ?? '');
  const displayUrl = useMemo(
    () => inviteLink?.replace(/^https?:\/\//, '') ?? '',
    [inviteLink]
  );

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
  }, [doCopy, inviteLink, isLoading, trackInviteShared]);

  const handleShareInviteLink = useCallback(async () => {
    if (isLoading || !inviteLink) return;

    try {
      if (isWeb) {
        if (typeof navigator.share === 'function') {
          await navigator.share({ url: inviteLink });
        } else {
          await doCopy();
        }
      } else {
        const result = await Share.share({
          message: inviteLink,
        });

        if (result.action !== Share.sharedAction) return;
      }

      trackInviteShared();
    } catch (error) {
      console.error('Error sharing:', error);
    }
  }, [doCopy, inviteLink, isLoading, trackInviteShared]);

  return (
    <YStack width="100%" gap="$l">
      <Button.Frame
        width="100%"
        size="medium"
        fill="ghost"
        backgroundColor="$secondaryBackground"
        cursor="default"
      >
        <Text
          flex={1}
          minWidth={0}
          numberOfLines={1}
          size="$mono/m"
          color="$tertiaryText"
        >
          {isLoading ? 'Preparing invite link' : displayUrl}
        </Text>
        <Button
          fill="text"
          intent="positive"
          label="Copy"
          leadingIcon={
            <Icon
              type={didCopy ? 'Checkmark' : 'Copy'}
              customSize={[18, 18]}
              color="$positiveActionText"
            />
          }
          accessibilityLabel={didCopy ? 'Copied' : 'Copy invite link'}
          disabled={isLoading}
          onPress={handleCopyInviteLink}
        />
      </Button.Frame>
      <Button
        preset="primary"
        label="Share link"
        centered
        disabled={isLoading}
        onPress={handleShareInviteLink}
      />
    </YStack>
  );
}
