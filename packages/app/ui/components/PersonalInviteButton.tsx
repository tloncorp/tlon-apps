import { Button, Icon, Text } from '@tloncorp/ui';
import { useCallback, useMemo } from 'react';
import { YStack } from 'tamagui';

import { useShareInviteLink } from '../hooks/useShareInviteLink';

export function PersonalInviteButton() {
  const { inviteLink, didCopy, copy, share } = useShareInviteLink();
  const isLoading = !inviteLink;
  const displayUrl = useMemo(
    () => inviteLink?.replace(/^https?:\/\//, '') ?? '',
    [inviteLink]
  );

  const handleCopyInviteLink = useCallback(() => {
    copy();
  }, [copy]);

  const handleShareInviteLink = useCallback(() => {
    share();
  }, [share]);

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
