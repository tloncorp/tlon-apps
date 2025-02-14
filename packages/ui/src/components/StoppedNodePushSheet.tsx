import * as db from '@tloncorp/shared/db';
import * as domain from '@tloncorp/shared/domain';
import { YStack } from 'tamagui';

import { ActionSheet } from './ActionSheet';
import { SigilAvatar } from './Avatar';
import { Button } from './Button';
import { Text } from './TextV2';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string;
  notifPerms: domain.NotifPerms;
}

export function StoppedNodePushSheet({
  open,
  onOpenChange,
  currentUserId,
  notifPerms,
}: Props) {
  return (
    <ActionSheet
      open={open}
      onOpenChange={onOpenChange}
      // snapPointsMode="percent"
      // snapPoints={[50]}
    >
      <ActionSheet.Content paddingBottom={20}>
        <ActionSheet.ContentBlock
          alignItems="center"
          gap={30}
          paddingHorizontal="$3xl"
          paddingTop="$3xl"
        >
          <SigilAvatar contactId="~latter-bolden" size="$9xl" renderDetail />
          <Text size="$label/l" paddingHorizontal="$2xl" textAlign="center">
            Your P2P node is waking up after a deep sleep.
            {!notifPerms.hasPermission && !notifPerms.canAskPermission ? (
              <>
                {' '}
                If you enable notifications, we can let you know when it's
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
                ? `Go to notification settings`
                : `Notify me when it's ready`}
            </Button.Text>
          </Button>
          <Text size="$label/s" color="$secondaryText">
            Feel free to close TM while your ship is waking up.
          </Text>
        </ActionSheet.ContentBlock>
      </ActionSheet.Content>
    </ActionSheet>
  );
}
