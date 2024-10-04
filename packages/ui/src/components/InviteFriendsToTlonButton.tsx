import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import { useCallback, useEffect } from 'react';
import { Share } from 'react-native';
import { Text, View, XStack, isWeb } from 'tamagui';

import { useBranchDomain, useBranchKey, useCurrentUserId } from '../contexts';
import { useCopy } from '../hooks/useCopy';
import { useIsAdmin } from '../utils';
import { Button } from './Button';
import { Icon } from './Icon';
import { LoadingSpinner } from './LoadingSpinner';

export function InviteFriendsToTlonButton({ group }: { group?: db.Group }) {
  const userId = useCurrentUserId();
  const isGroupAdmin = useIsAdmin(group?.id ?? '', userId);
  const branchDomain = useBranchDomain();
  const branchKey = useBranchKey();
  const { status, shareUrl, toggle, describe } = store.useLureLinkStatus({
    flag: group?.id ?? '',
    branchDomain: branchDomain,
    branchKey: branchKey,
  });
  const { doCopy } = useCopy(shareUrl || '');

  const handleInviteButtonPress = useCallback(async () => {
    if (shareUrl && status === 'ready' && group) {
      if (isWeb) {
        if (navigator.share !== undefined) {
          await navigator.share({
            title: `Join ${group.title} on Tlon`,
            url: shareUrl,
          });
          return;
        }

        doCopy();
        return;
      }

      await Share.share({
        message: `Join ${group.title} on Tlon: ${shareUrl}`,
        title: `Join ${group.title} on Tlon`,
      });

      return;
    }
  }, [group, shareUrl, doCopy, status]);

  useEffect(() => {
    const meta = {
      title: group?.title ?? '',
      description: group?.description ?? '',
      cover: group?.coverImage ?? '',
      image: group?.iconImage ?? '',
    };

    const toggleLink = async () => {
      if (!group) return;
      await toggle(meta);
    };
    if (status === 'disabled' && isGroupAdmin) {
      toggleLink();
    }
    if (status === 'stale') {
      describe(meta);
    }
  }, [group, branchDomain, branchKey, toggle, status, isGroupAdmin, describe]);

  if (
    (group?.privacy === 'private' || group?.privacy === 'secret') &&
    !isGroupAdmin
  ) {
    return <Text>Only administrators may invite people to this group.</Text>;
  }

  return (
    <Button
      hero
      disabled={status !== 'ready' || typeof shareUrl !== 'string'}
      onPress={handleInviteButtonPress}
      borderRadius="$xl"
      width="100%"
      justifyContent="space-between"
    >
      <XStack gap="$xl" paddingHorizontal="$m" alignItems="center">
        <View>
          {status === 'error' || status === 'disabled' ? (
            <Icon type="Close" size="$l" color="$background" />
          ) : null}
          {(status === 'loading' || status === 'stale') && (
            <LoadingSpinner size="small" color="$background" />
          )}
          {status === 'ready' && (
            <Icon type="Send" size="$l" color="$background" />
          )}
        </View>
        <Text flex={1} color="$background" fontSize="$l">
          {status === 'disabled' && 'Public invite links are disabled'}
          {status === 'error' && 'Error generating invite link'}
          {(status === 'loading' || status === 'stale') &&
            'Generating invite link...'}
          {status === 'ready' &&
            typeof shareUrl === 'string' &&
            'Invite Friends to Tlon'}
        </Text>
        {status === 'ready' && (
          <Icon type="ChevronRight" size="$l" color="$background" />
        )}
      </XStack>
    </Button>
  );
}
