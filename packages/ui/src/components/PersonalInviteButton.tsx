import { AnalyticsEvent, createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { useCallback, useMemo } from 'react';
import { Share } from 'react-native';
import { Text, View, XStack, isWeb } from 'tamagui';

import { useContact, useCurrentUserId } from '../contexts';
import { useCopy } from '../hooks/useCopy';
import { getDisplayName } from '../utils';
import { Button } from './Button';
import { Icon } from './Icon';

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
          inviteType: 'personal',
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
        message: `${userDisplayName} invited you to TM: ${inviteLink}`,
        title: `${userDisplayName} invited you to TMn`,
      });

      if (result.action === Share.sharedAction) {
        logger.trackEvent(AnalyticsEvent.InviteShared, {
          inviteId: inviteLink.split('/').pop() ?? null,
          inviteType: 'personal',
        });
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
    return;
  }, [doCopy, inviteLink, userDisplayName]);

  return (
    <Button
      hero
      onPress={handleInviteButtonPress}
      borderRadius="$xl"
      width="100%"
      justifyContent="space-between"
    >
      <XStack gap="$xl" paddingHorizontal="$m" alignItems="center">
        <View>
          <Icon type="Send" size="$l" color="$background" />
        </View>
        <Text flex={1} color="$background" fontSize="$l">
          Invite Friends to Tlon
        </Text>
        <Icon type="ChevronRight" size="$l" color="$background" />
      </XStack>
    </Button>
  );
}
