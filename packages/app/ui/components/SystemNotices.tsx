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
  backgroundColor: '$secondaryBackground',
  padding: '$2xl',
  marginHorizontal: '$l',
  borderRadius: '$2xl',
});

const NoticeText = styled(Text, {
  color: '$primaryText',
  size: '$label/l',
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
      <YStack paddingHorizontal="$2xl" gap="$2xl">
        <NoticeText>
          Sync your contact book to easily find people you know on Tlon.
        </NoticeText>
        {props.status === 'undetermined' && (
          <XStack gap="$m" justifyContent="center">
            <Button
              padding="$xl"
              paddingHorizontal="$2xl"
              backgroundColor="$secondaryBackground"
              onPress={handleDismiss}
            >
              <Button.Text color="$secondaryText">Not Now</Button.Text>
            </Button>
            <Button
              backgroundColor="$primaryText"
              padding="$xl"
              paddingHorizontal="$2xl"
              onPress={handlePrimaryAction}
            >
              <Button.Text color="$background">Continue</Button.Text>
            </Button>
          </XStack>
        )}
        {props.status === 'denied' && (
          <Button>
            <Button.Text color="$white">Open Settings</Button.Text>
          </Button>
        )}
      </YStack>
    </NoticeFrame>
  );
}
