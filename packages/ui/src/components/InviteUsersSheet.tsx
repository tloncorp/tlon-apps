import * as db from '@tloncorp/shared/dist/db';
import React, { useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionSheet } from './ActionSheet';
import { InviteUsersWidget } from './InviteUsersWidget';

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
  const hasOpened = useRef(open);

  if (!hasOpened.current && open) {
    hasOpened.current = true;
  }

  if (!hasOpened.current || !group) return null;

  return (
    <ActionSheet
      open={open}
      onOpenChange={onOpenChange}
      snapPoints={[85]}
      snapPointsMode="percent"
    >
      <ActionSheet.Content flex={1} paddingBottom={bottom}>
        <InviteUsersWidget group={group} onInviteComplete={onInviteComplete} />
      </ActionSheet.Content>
    </ActionSheet>
  );
};

export const InviteUsersSheet = React.memo(InviteUsersSheetComponent);
