import { useChatSettingsNavigation } from '@tloncorp/app/hooks/useChatSettingsNavigation';
import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import { useCallback, useRef } from 'react';

import { useChatOptionsContextValue } from '../../contexts';
import { Button } from '../Button';
import { ChatOptionsSheet, ChatOptionsSheetMethods } from '../ChatOptionsSheet';
import { GenericHeader } from '../GenericHeader';
import { Icon } from '../Icon';
import { BaubleHeader } from './BaubleHeader';

export function ChannelHeader({
  title,
  mode = 'default',
  channel,
  group,
  goBack,
  goToSearch,
  showSpinner,
  showSearchButton = true,
  showMenuButton = false,
}: {
  title: string;
  mode?: 'default' | 'next';
  channel: db.Channel;
  group?: db.Group | null;
  goBack?: () => void;
  goToSearch?: () => void;
  showSpinner?: boolean;
  showSearchButton?: boolean;
  showMenuButton?: boolean;
  post?: db.Post;
  setEditingPost?: (post: db.Post) => void;
}) {
  const { data: pinned } = store.usePins();
  const chatOptionsSheetRef = useRef<ChatOptionsSheetMethods>(null);

  const chatOptionsContext = useChatOptionsContextValue({
    channelId: channel.id,
    groupId: undefined,
    pinned: pinned ?? [],
    ...useChatSettingsNavigation(),
  });

  const handlePressOverflowMenu = useCallback(() => {
    chatOptionsSheetRef.current?.open(channel.id, channel.type);
  }, [channel.id, channel.type]);

  if (mode === 'next') {
    return <BaubleHeader channel={channel} group={group} />;
  }

  return (
    <>
      <GenericHeader
        title={title}
        goBack={goBack}
        showSpinner={showSpinner}
        rightContent={
          <>
            {showSearchButton && (
              <Button
                backgroundColor="unset"
                borderColor="transparent"
                onPress={goToSearch}
              >
                <Icon type="Search" />
              </Button>
            )}
            {showMenuButton && (
              <Button
                backgroundColor="unset"
                borderColor="transparent"
                onPress={handlePressOverflowMenu}
              >
                <Icon type="Dots" />
              </Button>
            )}
          </>
        }
      />
      <ChatOptionsSheet chatOptionsContext={chatOptionsContext} />
    </>
  );
}
