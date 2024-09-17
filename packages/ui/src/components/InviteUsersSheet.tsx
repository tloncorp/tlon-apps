import * as db from '@tloncorp/shared/dist/db';
import React, { useRef } from 'react';
import { Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const hasOpened = useRef(open);

  if (!hasOpened.current && open) {
    hasOpened.current = true;
  }

  if (!hasOpened.current || !group) return null;

  return (
    <Modal
      visible={open}
      onRequestClose={() => onOpenChange(false)}
      transparent
      animationType="none"
    >
      <Sheet
        open={open}
        onOpenChange={onOpenChange}
        snapPoints={[85]}
        dismissOnSnapToBottom
        animation="quick"
      >
        <Sheet.Overlay />
        <Sheet.LazyFrame
          paddingTop="$s"
          paddingHorizontal="$2xl"
          paddingBottom={bottom}
        >
          <Sheet.Handle marginBottom="$l" />
          <InviteUsersWidget
            group={group}
            onInviteComplete={onInviteComplete}
          />
        </Sheet.LazyFrame>
      </Sheet>
    </Modal>
  );
};

export const InviteUsersSheet = React.memo(InviteUsersSheetComponent);
