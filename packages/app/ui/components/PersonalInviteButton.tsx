import { AnalyticsEvent, createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { Pressable, useCopy } from '@tloncorp/ui';
import { useCallback } from 'react';
import { Share } from 'react-native';
import { isWeb } from 'tamagui';

import { ListItem } from './ListItem';

const logger = createDevLogger('PersonalInviteButton', true);

export function PersonalInviteButton() {
  // must be pre-populated before rendering this component
  const inviteLink = db.personalInviteLink.useValue() as string;
  const { doCopy, didCopy } = useCopy(inviteLink);

  const handleInviteButtonPress = useCallback(async () => {
    if (isWeb) {
      doCopy();
      return;
    }

    try {
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
  }, [doCopy, inviteLink]);

  return (
    // <Button hero onPress={handleInviteButtonPress} height={72}>
    //   <Button.Icon>
    //     <Icon type="Send" />
    //   </Button.Icon>
    //   <Text color="$background" size="$label/l">
    //     {didCopy ? 'Copied' : 'Share Invite Link'}
    //   </Text>
    // </Button>
    <Pressable onPress={handleInviteButtonPress}>
      <ListItem backgroundColor="$primaryText">
        <ListItem.SystemIcon
          icon="Send"
          color="$background"
          backgroundColor="unset"
        />
        <ListItem.MainContent>
          <ListItem.Title color="$background">
            {didCopy ? 'Copied' : 'Share Invite Link'}
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
