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
  showSearchButton = true,
  showMenuButton = false,
  onPressAddPost,
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
  onPressAddPost?: () => void;
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
        isLoading={showSpinner}
        leftControls={<ScreenHeader.BackButton onPress={goBack} />}
        rightControls={
          <>
            {showSearchButton && (
              <ScreenHeader.IconButton type="Search" onPress={goToSearch} />
            )}
            {channel.type === 'notebook' || channel.type === 'gallery' ? (
              <ScreenHeader.IconButton type="Add" onPress={onPressAddPost} />
            ) : null}
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
