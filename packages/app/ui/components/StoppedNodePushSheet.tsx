import * as domain from '@tloncorp/shared/domain';
import { Button } from '@tloncorp/ui';
import { Text } from '@tloncorp/ui';

import { AppDataContextProvider, useStore } from '../contexts';
import { ActionSheet } from './ActionSheet';
import { SigilAvatar } from './Avatar';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string;
  notifPerms: domain.NotifPerms;
}

export function StoppedNodePushSheet({
  open,
  onOpenChange,
  notifPerms,
}: Props) {
  const store = useStore();
  const { data: contacts } = store.useContacts();
  return (
    <ActionSheet open={open} onOpenChange={onOpenChange} modal>
      <ActionSheet.Content paddingBottom={20}>
        {/* since the modaled sheet gets pulled above the contacts provider, we inject a manual one here */}
        <AppDataContextProvider contacts={contacts}>
          <ActionSheet.ContentBlock
            alignItems="center"
            gap={30}
            paddingHorizontal="$3xl"
            paddingTop="$3xl"
          >
            <SigilAvatar contactId="~latter-bolden" size="$9xl" renderDetail />
            <Text size="$label/l" paddingHorizontal="$2xl" textAlign="center">
              Your P2P node is waking up after a deep sleep.{' '}
              {!notifPerms.hasPermission && !notifPerms.canAskPermission ? (
                <>
                  If you enable push notifications, we can let you know when
                  it's ready.
                </>
              ) : (
                <>This usually takes just a few minutes.</>
              )}
            </Text>
            <Button
              size="large"
              fill="solid"
              type="primary"
              centered
              onPress={
                !notifPerms.hasPermission && !notifPerms.canAskPermission
                  ? notifPerms.openSettings
                  : notifPerms.requestPermissions
              }
              label={
                !notifPerms.hasPermission && !notifPerms.canAskPermission
                  ? `View notification settings`
                  : `Notify me when it's ready`
              }
            />
            <Text size="$label/s" color="$secondaryText">
              Feel free to close the app while your node is waking up.
            </Text>
          </ActionSheet.ContentBlock>
        </AppDataContextProvider>
      </ActionSheet.Content>
    </ActionSheet>
  );
}
