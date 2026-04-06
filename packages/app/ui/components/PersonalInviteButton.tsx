import { AnalyticsEvent, createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import {
  LoadingSpinner,
  Pressable,
  triggerHaptic,
  useCopy,
} from '@tloncorp/ui';
import { useCallback } from 'react';
import { Share } from 'react-native';
import { View, isWeb } from 'tamagui';

import { ListItem } from './ListItem';

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
      const result = await Share.share({
        message: inviteLink,
      });

      if (result.action === Share.sharedAction) {
        logger.trackEvent(AnalyticsEvent.InviteShared, {
          inviteId: inviteLink.split('/').pop() ?? null,
          inviteType: 'user',
        });
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
    return;
  }, [doCopy, inviteLink, isLoading]);

  return (
    <Pressable onPress={handleInviteButtonPress} disabled={isLoading}>
      <ListItem backgroundColor="$primaryText" opacity={isLoading ? 0.6 : 1}>
        {isLoading ? (
          <View
            width="$4xl"
            height="$4xl"
            borderRadius="$s"
            justifyContent="center"
            alignItems="center"
            flexShrink={0}
            alignSelf="center"
          >
            <LoadingSpinner size="small" color="$background" />
          </View>
        ) : (
          <ListItem.SystemIcon
            icon="Send"
            color="$background"
            backgroundColor="unset"
          />
        )}
        <ListItem.MainContent>
          <ListItem.Title color="$background">
            {isLoading
              ? 'Preparing invite link'
              : didCopy
                ? 'Copied'
                : 'Share Invite Link'}
          </ListItem.Title>
        </ListItem.MainContent>
        <ListItem.EndContent>
          <ListItem.SystemIcon
            icon="ChevronRight"
            color="$background"
            backgroundColor="unset"
          />
        </ListItem.EndContent>
      </ListItem>
    </Pressable>
  );
}
