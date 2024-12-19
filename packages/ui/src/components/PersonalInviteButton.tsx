import { AnalyticsEvent, createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { useCallback, useMemo } from 'react';
import { Share } from 'react-native';
import { isWeb } from 'tamagui';

import { TlonText } from '..';
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
        title: `${userDisplayName} invited you to TM`,
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
    <Button hero onPress={handleInviteButtonPress}>
      <Button.Icon>
        <Icon type="Link" />
      </Button.Icon>
      <TlonText.Text color="$background" size="$label/l">
        Share invite link
      </TlonText.Text>
    </Button>
  );
}
