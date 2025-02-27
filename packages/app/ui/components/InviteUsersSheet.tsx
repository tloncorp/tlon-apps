import * as store from '@tloncorp/shared/store';
import React, { useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionSheet } from './ActionSheet';
import { InviteUsersWidget } from './InviteUsersWidget';

const InviteUsersSheetComponent = ({
  open,
  onOpenChange,
  groupId,
  onInviteComplete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId?: string;
  onInviteComplete: () => void;
}) => {
  const { bottom } = useSafeAreaInsets();
  const hasOpened = useRef(open);
  const { data: group } = store.useGroup({ id: groupId });

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
      <ActionSheet.Content
        // prevent the modal from going off screen
        flex={1}
        paddingBottom={bottom}
      >
        <InviteUsersWidget group={group} onInviteComplete={onInviteComplete} />
      </ActionSheet.Content>
    </ActionSheet>
  );
};

export const InviteUsersSheet = React.memo(InviteUsersSheetComponent);
