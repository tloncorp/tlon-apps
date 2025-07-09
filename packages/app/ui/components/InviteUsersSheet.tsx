import React, { useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStore } from '../contexts/storeContext';
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
  const store = useStore();
  const { data: group } = store.useGroup({ id: groupId });
  const [isScrolling, setIsScrolling] = useState(false);

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
      disableDrag={isScrolling}
    >
      <ActionSheet.Content
        // prevent the modal from going off screen
        flex={1}
        paddingBottom={bottom}
      >
        <InviteUsersWidget
          group={group}
          onInviteComplete={onInviteComplete}
          onScrollChange={setIsScrolling}
        />
      </ActionSheet.Content>
    </ActionSheet>
  );
};

export const InviteUsersSheet = React.memo(InviteUsersSheetComponent);
