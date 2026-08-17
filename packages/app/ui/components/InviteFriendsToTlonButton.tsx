import {
  AnalyticsEvent,
  createDevLogger,
  enableGroupLinks,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { Button, Icon, Text, useCopy } from '@tloncorp/ui';
import { ComponentProps, useCallback, useEffect, useMemo } from 'react';
import { Share } from 'react-native';
import { YStack, isWeb } from 'tamagui';

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
  | 'trailingIcon'
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
  const displayUrl = useMemo(
    () => shareUrl?.replace(/^https?:\/\//, '') ?? '',
    [shareUrl]
  );

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
  const linkHasError = status === 'error' || status === 'unsupported';
  const linkFailed = linkIsDisabled || linkHasError;

  const inviteLinkPlaceholder = linkIsDisabled
    ? 'Invite links are disabled'
    : linkFailed
      ? 'Error generating invite link'
      : linkIsLoading
        ? 'Generating invite link...'
        : '';

  return (
    <YStack width="100%" gap="$l">
      {/* Button.Frame so the field matches the share button's height and radius */}
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
          color={linkHasError ? '$negativeActionText' : '$tertiaryText'}
        >
          {linkIsReady ? displayUrl : inviteLinkPlaceholder}
        </Text>
        {!linkFailed && (
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
            disabled={!linkIsReady}
            onPress={handleCopyInviteLink}
          />
        )}
      </Button.Frame>
      <Button
        {...buttonProps}
        preset={preset}
        label="Share link"
        centered
        disabled={!linkIsReady}
        onPress={handleShareInviteLink}
      />
    </YStack>
  );
}
