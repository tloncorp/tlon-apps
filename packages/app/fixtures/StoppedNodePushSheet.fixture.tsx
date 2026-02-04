import * as domain from '@tloncorp/shared/domain';
import { useState } from 'react';
import { YStack } from 'tamagui';

import { OnboardingButton } from '../ui/components/Onboarding';
import { StoppedNodePushSheet } from '../ui/components/StoppedNodePushSheet';
import { FixtureWrapper } from './FixtureWrapper';

const mockNotifPermsWithPermission: domain.NotifPerms = {
  initialized: true,
  hasPermission: true,
  canAskPermission: false,
  openSettings: () => console.log('Opening settings'),
  requestPermissions: async () => console.log('Requesting permissions'),
};

const mockNotifPermsNeedRequest: domain.NotifPerms = {
  initialized: true,
  hasPermission: false,
  canAskPermission: true,
  openSettings: () => console.log('Opening settings'),
  requestPermissions: async () => console.log('Requesting permissions'),
};

const mockNotifPermsNeedSettings: domain.NotifPerms = {
  initialized: true,
  hasPermission: false,
  canAskPermission: false,
  openSettings: () => console.log('Opening settings'),
  requestPermissions: async () => console.log('Requesting permissions'),
};

function StoppedNodePushSheetFixture({
  notifPerms,
}: {
  notifPerms: domain.NotifPerms;
}) {
  const [open, setOpen] = useState(true);

  return (
    <FixtureWrapper fillWidth fillHeight safeArea>
      <YStack flex={1} justifyContent="center" alignItems="center">
        <OnboardingButton label="Open Sheet" onPress={() => setOpen(true)} />
      </YStack>
      <StoppedNodePushSheet
        open={open}
        onOpenChange={setOpen}
        currentUserId="~zod"
        notifPerms={notifPerms}
      />
    </FixtureWrapper>
  );
}

export default {
  'Can Request Permissions': (
    <StoppedNodePushSheetFixture notifPerms={mockNotifPermsNeedRequest} />
  ),
  'Needs Settings': (
    <StoppedNodePushSheetFixture notifPerms={mockNotifPermsNeedSettings} />
  ),
  'Has Permission': (
    <StoppedNodePushSheetFixture notifPerms={mockNotifPermsWithPermission} />
  ),
};
