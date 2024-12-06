import * as db from '@tloncorp/shared/db';
import React, { useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTokenValue, useWindowDimensions } from 'tamagui';

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
  const { height } = useWindowDimensions();
  const maxHeight = height - bottom - getTokenValue('$2xl');

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
        maxHeight={maxHeight}
        flex={1}
        paddingBottom={bottom}
      >
        <InviteUsersWidget group={group} onInviteComplete={onInviteComplete} />
      </ActionSheet.Content>
    </ActionSheet>
  );
};

export const InviteUsersSheet = React.memo(InviteUsersSheetComponent);
