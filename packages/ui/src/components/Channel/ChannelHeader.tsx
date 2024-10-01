import * as db from '@tloncorp/shared/dist/db';
import { useCallback, useRef } from 'react';

import { ChatOptionsSheet, ChatOptionsSheetMethods } from '../ChatOptionsSheet';
import { ScreenHeader } from '../ScreenHeader';
import { BaubleHeader } from './BaubleHeader';

export function ChannelHeader({
  title,
  mode = 'default',
  channel,
  group,
  goBack,
  goToSearch,
  showSpinner,
  showAddButton = false,
  onPressAddButton,
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
  showAddButton?: boolean;
  onPressAddButton?: () => void;
  showSearchButton?: boolean;
  showMenuButton?: boolean;
  post?: db.Post;
}) {
  const chatOptionsSheetRef = useRef<ChatOptionsSheetMethods>(null);

  const handlePressOverflowMenu = useCallback(() => {
    chatOptionsSheetRef.current?.open(channel.id, channel.type);
  }, [channel.id, channel.type]);

  if (mode === 'next') {
    return <BaubleHeader channel={channel} group={group} />;
  }

  return (
    <>
      <ScreenHeader
        title={title}
        showSessionStatus
        isLoading={showSpinner}
        leftControls={<ScreenHeader.BackButton onPress={goBack} />}
        rightControls={
          <>
            {showSearchButton && (
              <ScreenHeader.IconButton type="Search" onPress={goToSearch} />
            )}
            {showAddButton && (
              <ScreenHeader.IconButton type="Add" onPress={onPressAddButton} />
            )}
            {showMenuButton && (
              <ScreenHeader.IconButton
                type="Overflow"
                onPress={handlePressOverflowMenu}
              />
            )}
          </>
        }
      />
      <ChatOptionsSheet ref={chatOptionsSheetRef} />
    </>
  );
}
