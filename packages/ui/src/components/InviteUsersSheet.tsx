import * as db from '@tloncorp/shared/dist/db';
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionSheet } from './ActionSheet';
import { InviteUsersWidget } from './InviteUsersWidget';
import { Sheet } from './Sheet';

const InviteUsersSheetComponent = ({
  open,
  onOpenChange,
  group,
  onInviteComplete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group?: db.Group;
  onInviteComplete: () => void;
}) => {
  const { bottom } = useSafeAreaInsets();

  if (!group) {
    return null;
  }

  return (
    <ActionSheet
      open={open}
      onOpenChange={onOpenChange}
      snapPoints={[85]}
      snapPointsMode="percent"
    >
      <ActionSheet.Content flex={1}>
        <InviteUsersWidget group={group} onInviteComplete={onInviteComplete} />
      </ActionSheet.Content>
    </ActionSheet>
  );
};

export const InviteUsersSheet = React.memo(InviteUsersSheetComponent);
