import {
  AnalyticsEvent,
  createDevLogger,
  enableGroupLinks,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { Button, Text, useCopy } from '@tloncorp/ui';
import { ComponentProps, useCallback, useEffect } from 'react';
import { Share } from 'react-native';
import { XStack, isWeb } from 'tamagui';

import { useCurrentUserId, useInviteService } from '../contexts/appDataContext';
import { useIsAdmin } from '../utils';

const logger = createDevLogger('InviteButton', false);

export function InviteFriendsToTlonButton({
  group,
  ...props
}: { group?: db.Group } & Omit<
  ComponentProps<typeof Button>,
  | 'group'
  | 'icon'
  | 'label'
  | 'leadingIcon'
  | 'onPress'
  | 'loading'
  | 'disabled'
>) {
  const { preset = 'primary', ...buttonProps } = props;
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
  }, [group?.id]);

  const trackInviteShared = useCallback(() => {
    if (!shareUrl) return;

    logger.trackEvent(AnalyticsEvent.InviteShared, {
      inviteId: shareUrl.split('/').pop() ?? null,
      inviteType: 'group',
    });
  }, [shareUrl]);

  const handleCopyInviteLink = useCallback(async () => {
    if (!shareUrl || status !== 'ready' || !group) return;

    await doCopy();
    trackInviteShared();
  }, [doCopy, group, shareUrl, status, trackInviteShared]);

  const handleShareInviteLink = useCallback(async () => {
    if (!shareUrl || status !== 'ready' || !group) return;

    try {
      if (isWeb) {
        if (typeof navigator.share === 'function') {
          await navigator.share({ url: shareUrl });
        } else {
          await doCopy();
        }
      } else {
        const result = await Share.share({
          message: shareUrl,
        });

        if (result.action !== Share.sharedAction) return;
      }

      trackInviteShared();
    } catch (error) {
      console.error('Error sharing:', error);
    }
  }, [doCopy, group, shareUrl, status, trackInviteShared]);

  useEffect(() => {
    const enableLinks = async () => {
      if (!group?.id) return;
      try {
        await enableGroupLinks(group.id);
        logger.trackEvent(AnalyticsEvent.InviteDebug, {
          group: group?.id,
          context: 'enabled group on %grouper',
        });
      } catch (e) {
        logger.trackEvent(AnalyticsEvent.InviteError, {
          context: 'failed to enable group link',
          groupId: group.id,
          error: e,
        });
      }
    };
    enableLinks();
  }, [group?.id]);

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

  const copyButtonLabel = didCopy
    ? 'Copied'
    : linkIsReady
      ? 'Copy invite link'
      : linkIsDisabled
        ? 'Invite links are disabled'
        : linkFailed
          ? 'Error generating invite link'
          : linkIsLoading
            ? 'Generating invite link...'
            : '';

  return (
    <XStack width="100%" gap="$m">
      <Button
        {...buttonProps}
        flex={1}
        preset={preset}
        size="small"
        label={copyButtonLabel}
        leadingIcon={linkIsLoading ? undefined : 'Link'}
        loading={linkIsLoading}
        disabled={!linkIsReady}
        onPress={handleCopyInviteLink}
      />
      <Button
        {...buttonProps}
        flex={1}
        preset={preset}
        fill="outline"
        size="small"
        label="Share link"
        leadingIcon="Send"
        disabled={!linkIsReady}
        onPress={handleShareInviteLink}
      />
    </XStack>
  );
}
