import * as domain from '@tloncorp/shared/domain';
import { Button } from '@tloncorp/ui';
import { Text } from '@tloncorp/ui';

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
  return (
    <ActionSheet open={open} onOpenChange={onOpenChange}>
      <ActionSheet.Content paddingBottom={20}>
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
                If you enable push notifications, we can let you know when it's
                ready.
              </>
            ) : (
              <>This usually takes just a few minutes.</>
            )}
          </Text>
          <Button
            hero
            onPress={
              !notifPerms.hasPermission && !notifPerms.canAskPermission
                ? notifPerms.openSettings
                : notifPerms.requestPermissions
            }
          >
            <Button.Text>
              {!notifPerms.hasPermission && !notifPerms.canAskPermission
                ? `View notification settings`
                : `Notify me when it's ready`}
            </Button.Text>
          </Button>
          <Text size="$label/s" color="$secondaryText">
            Feel free to close the app while your node is waking up.
          </Text>
        </ActionSheet.ContentBlock>
      </ActionSheet.Content>
    </ActionSheet>
  );
}
