import {
  AnalyticsEvent,
  createDevLogger,
  enableGroupLinks,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useCopy } from '@tloncorp/ui';
import { Button } from '@tloncorp/ui';
import { Icon } from '@tloncorp/ui';
import { LoadingSpinner } from '@tloncorp/ui';
import { Text } from '@tloncorp/ui';
import { ComponentProps, useCallback, useEffect } from 'react';
import { Share } from 'react-native';
import { isWeb } from 'tamagui';

import { useCurrentUserId, useInviteService } from '../contexts';
import { useIsAdmin } from '../utils';

const logger = createDevLogger('InviteButton', true);

export function InviteFriendsToTlonButton({
  group,
  ...props
}: { group?: db.Group } & Omit<ComponentProps<typeof Button>, 'group'>) {
  const userId = useCurrentUserId();
  const isGroupAdmin = useIsAdmin(group?.id ?? '', userId);
  const inviteService = useInviteService();
  const { status, shareUrl } = store.useLure({
    flag: group?.id ?? '',
    inviteServiceEndpoint: inviteService.endpoint,
    inviteServiceIsDev: inviteService.isDev,
  });
  const { doCopy, didCopy } = useCopy(shareUrl || '');

  useEffect(() => {
    logger.trackEvent('Invite Button Shown', { group: group?.id });
  }, []);

  const handleInviteButtonPress = useCallback(async () => {
    if (shareUrl && status === 'ready' && group) {
      if (isWeb) {
        logger.trackEvent(AnalyticsEvent.InviteShared, {
          inviteId: shareUrl.split('/').pop() ?? null,
          inviteType: 'group',
        });

        doCopy();
        return;
      }

      try {
        const result = await Share.share({
          message: shareUrl,
        });

        if (result.action === Share.sharedAction) {
          logger.trackEvent(AnalyticsEvent.InviteShared, {
            inviteId: shareUrl.split('/').pop() ?? null,
            inviteType: 'group',
          });
        }
      } catch (error) {
        console.error('Error sharing:', error);
      }
      return;
    }
  }, [shareUrl, status, group, doCopy]);

  useEffect(() => {
    const enableLinks = async () => {
      if (!group) return;
      await enableGroupLinks(group.id);
    };

    logger.trackEvent(AnalyticsEvent.InviteDebug, {
      group: group?.id,
      context: 'invite button: disabled and isAdmin, enabling',
    });
    enableLinks();
  }, [group]);

  if (
    (group?.privacy === 'private' || group?.privacy === 'secret') &&
    !isGroupAdmin
  ) {
    return (
      <Text size="$label/l">
        Only administrators may invite people to this group.
      </Text>
    );
  }

  const linkIsLoading = status === 'loading' || status === 'stale';
  const linkIsReady = status === 'ready' && typeof shareUrl === 'string';
  const linkIsDisabled = status === 'disabled';
  const linkFailed =
    linkIsDisabled || status === 'error' || status === 'unsupported';

  return (
    <Button
      secondary
      disabled={!linkIsReady}
      onPress={handleInviteButtonPress}
      {...props}
    >
      {linkIsReady ? (
        <Icon type="Link" color="$secondaryText" size="$m" />
      ) : linkIsLoading ? (
        <LoadingSpinner size="small" />
      ) : linkFailed ? (
        <Icon type="Placeholder" color="$secondaryText" size="$m" />
      ) : null}
      <Button.Text>
        {didCopy
          ? 'Copied'
          : linkIsReady
            ? 'Share Invite Link'
            : linkIsDisabled
              ? 'Public invite links are disabled'
              : linkFailed
                ? 'Error generating invite link'
                : linkIsLoading
                  ? 'Generating invite link...'
                  : null}
      </Button.Text>
    </Button>
  );
}
