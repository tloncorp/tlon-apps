import * as db from '@tloncorp/shared/dist/db';
import React from 'react';
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

  if (!group) {
    return null;
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      snapPoints={[85]}
      modal
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
        <InviteUsersWidget group={group} onInviteComplete={onInviteComplete} />
      </Sheet.LazyFrame>
    </Sheet>
  );
};

export const InviteUsersSheet = React.memo(InviteUsersSheetComponent);
