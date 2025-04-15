import { AnalyticsEvent, createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { useCopy } from '@tloncorp/ui';
import { Button } from '@tloncorp/ui';
import { Icon } from '@tloncorp/ui';
import { Text } from '@tloncorp/ui';
import { useCallback } from 'react';
import { Share } from 'react-native';
import { isWeb } from 'tamagui';

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
    <Button hero onPress={handleInviteButtonPress}>
      <Button.Icon>
        <Icon type="AddPerson" />
      </Button.Icon>
      <Text color="$background" size="$label/l">
        {didCopy ? 'Copied' : 'Invite Friends'}
      </Text>
    </Button>
  );
}
