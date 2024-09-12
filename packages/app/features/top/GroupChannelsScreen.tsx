import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import { ChatOptionsProvider, GroupChannelsScreenView } from '@tloncorp/ui';
import { useCallback, useMemo } from 'react';

import { useChatSettingsNavigation } from '../../hooks/useChatSettingsNavigation';
import { useCurrentUserId } from '../../hooks/useCurrentUser';
import { useIsFocused } from '../../hooks/useIsFocused';

export function GroupChannelsScreen({
  groupParam,
  navigateToChannel,
  goBack,
}: {
  groupParam: db.Group;
  navigateToChannel: (channel: db.Channel) => void;
  goBack: () => void;
}) {
  const currentUser = useCurrentUserId();
  const isFocused = useIsFocused();
  const { data: pins } = store.usePins({
    enabled: isFocused,
  });

  const pinnedItems = useMemo(() => {
    return pins ?? [];
  }, [pins]);

  const handleChannelSelected = useCallback(
    (channel: db.Channel) => {
      navigateToChannel(channel);
    },
    [navigateToChannel]
  );

  const handleGoBackPressed = useCallback(() => {
    goBack();
  }, [goBack]);

  return (
    <ChatOptionsProvider
      groupId={groupParam.id}
      pinned={pinnedItems}
      useGroup={store.useGroup}
      {...useChatSettingsNavigation()}
    >
      <GroupChannelsScreenView
        onChannelPressed={handleChannelSelected}
        onBackPressed={handleGoBackPressed}
        currentUser={currentUser}
      />
    </ChatOptionsProvider>
  );
}
