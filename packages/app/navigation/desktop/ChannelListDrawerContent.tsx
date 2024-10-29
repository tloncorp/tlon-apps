import { DrawerContentComponentProps } from '@react-navigation/drawer';
import { useIsFocused } from '@react-navigation/native';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import {
  ChatOptionsProvider,
  GroupChannelsScreenView,
  InviteUsersSheet,
} from '@tloncorp/ui';
import { useMemo, useState } from 'react';

import { useChatSettingsNavigation } from '../../hooks/useChatSettingsNavigation';
import { useGroupContext } from '../../hooks/useGroupContext';

type ChannelListDrawerContentProps = DrawerContentComponentProps & {
  groupId: string;
  onChannelPress: (channel: db.Channel) => void;
  onBack: () => void;
};

export const ChannelListDrawerContent = (
  props: ChannelListDrawerContentProps
) => {
  const isFocused = useIsFocused();
  const [inviteSheetGroup, setInviteSheetGroup] = useState<db.Group | null>(
    null
  );

  const { data: pins } = store.usePins({
    enabled: isFocused,
  });

  const pinnedItems = useMemo(() => {
    return pins ?? [];
  }, [pins]);

  const { group } = useGroupContext({ groupId: props.groupId, isFocused });

  return (
    <ChatOptionsProvider
      groupId={props.groupId}
      pinned={pinnedItems}
      useGroup={store.useGroup}
      onPressInvite={(group) => {
        setInviteSheetGroup(group);
      }}
      {...useChatSettingsNavigation()}
    >
      <GroupChannelsScreenView
        onBackPressed={props.onBack}
        onChannelPressed={props.onChannelPress}
        group={group}
      />
      <InviteUsersSheet
        open={inviteSheetGroup !== null}
        onOpenChange={(open) => {
          if (!open) {
            setInviteSheetGroup(null);
          }
        }}
        group={inviteSheetGroup ?? undefined}
        onInviteComplete={() => setInviteSheetGroup(null)}
      />
    </ChatOptionsProvider>
  );
};
