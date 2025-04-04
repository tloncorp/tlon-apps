import { AnalyticsEvent, createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { useCopy } from '@tloncorp/ui';
import { Button } from '@tloncorp/ui';
import { Icon } from '@tloncorp/ui';
import { Text } from '@tloncorp/ui';
import { useCallback, useMemo } from 'react';
import { Share } from 'react-native';
import { isWeb } from 'tamagui';

import { useContact, useCurrentUserId } from '../contexts';
import { getDisplayName } from '../utils';

const logger = createDevLogger('PersonalInviteButton', true);

export function PersonalInviteButton() {
  const currentUserId = useCurrentUserId();
  const userContact = useContact(currentUserId);
  // must be pre-populated before rendering this component
  const inviteLink = db.personalInviteLink.useValue() as string;
  const { doCopy } = useCopy(inviteLink);

  const userDisplayName = useMemo(
    () => (userContact ? getDisplayName(userContact) : currentUserId),
    [userContact, currentUserId]
  );

  const handleInviteButtonPress = useCallback(async () => {
    if (isWeb) {
      if (navigator.share !== undefined) {
        logger.trackEvent(AnalyticsEvent.InviteShared, {
          inviteId: inviteLink.split('/').pop() ?? null,
          inviteType: 'user',
        });
        await navigator.share({
          title: `${userDisplayName} invited you to TM`,
          url: inviteLink,
        });
        return;
      }

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
  }, [doCopy, inviteLink, userDisplayName]);

  return (
    <Button hero onPress={handleInviteButtonPress}>
      <Button.Icon>
        <Icon type="Link" />
      </Button.Icon>
      <Text color="$background" size="$label/l">
        Share Invite Link
      </Text>
    </Button>
  );
}
