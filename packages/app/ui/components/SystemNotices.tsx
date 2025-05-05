import * as db from '@tloncorp/shared/db';
import { Button, Text } from '@tloncorp/ui';
import { useCallback } from 'react';
import { XStack, YStack, isWeb, styled } from 'tamagui';

import { useContactPermissions } from '../../hooks/useContactPermissions';
import { useStore } from '../contexts';

const SystemNotices = {
  ContactBookPrompt,
};

const NoticeFrame = styled(YStack, {
  backgroundColor: '$systemNoticeBackground',
  padding: '$2xl',
  marginHorizontal: '$l',
  borderRadius: '$l',
});

const NoticeBody = styled(Text, {
  color: '$systemNoticeText',
  opacity: 0.7,
  size: '$label/l',
});

const NoticeTitle = styled(Text, {
  color: '$systemNoticeText',
  size: '$label/xl',
  fontWeight: '600',
});

export default SystemNotices;

export function ContactBookPrompt(props: {
  status: 'denied' | 'granted' | 'undetermined';
  onDismiss: () => void;
  onRequestAccess: () => void;
  onOpenSettings: () => void;
}) {
  const store = useStore();
  const perms = useContactPermissions();
  const didDismiss = db.didDismissSystemContactsPrompt.useStorageItem();

  const handleDismiss = useCallback(() => {
    didDismiss.setValue(true);
  }, [didDismiss]);

  const handlePrimaryAction = useCallback(async () => {
    if (perms.canAskPermission) {
      const result = await perms.requestPermissions();
      if (result === 'granted') {
        await store.syncSystemContacts();
        await store.syncContactDiscovery();
      }
      didDismiss.setValue(true);
    } else {
      perms.openSettings();
    }
  }, [didDismiss, perms, store]);

  if (
    isWeb ||
    perms.isLoading ||
    perms.status === 'granted' ||
    didDismiss.value
  ) {
    return null;
  }

  return (
    <NoticeFrame>
      <YStack gap="$5xl">
        <YStack gap="$xl">
          <NoticeTitle>Find Friends</NoticeTitle>
          <NoticeBody>
            Sync your contact book to easily find people you know on Tlon.
          </NoticeBody>
        </YStack>
        {props.status === 'undetermined' && (
          <XStack gap="$m" justifyContent="flex-end">
            <Button
              padding="$xl"
              paddingHorizontal="$2xl"
              backgroundColor="$systemNoticeBackground"
              borderColor="$positiveBorder"
              borderWidth={1.6}
              pressStyle={{
                opacity: 0.7,
                backgroundColor: '$systemNoticeBackground',
              }}
              onPress={handleDismiss}
            >
              <Button.Text color="$systemNoticeText" fontWeight="500">
                Not Now
              </Button.Text>
            </Button>
            <Button
              backgroundColor="$systemNoticeText"
              padding="$xl"
              paddingHorizontal="$2xl"
              borderWidth={0}
              pressStyle={{
                opacity: 0.8,
                backgroundColor: '$systemNoticeText',
              }}
              onPress={handlePrimaryAction}
            >
              <Button.Text color="$systemNoticeBackground" fontWeight="500">
                Continue
              </Button.Text>
            </Button>
          </XStack>
        )}
        {props.status === 'denied' && (
          <Button>
            <Button.Text color="$systemNoticeText">Open Settings</Button.Text>
          </Button>
        )}
      </YStack>
    </NoticeFrame>
  );
}
