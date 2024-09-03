import * as db from '@tloncorp/shared/dist/db';
import { useCallback, useRef } from 'react';

import { Dots, Search } from '../../assets/icons';
import { ChatOptionsSheet, ChatOptionsSheetMethods } from '../ChatOptionsSheet';
import { GenericHeader } from '../GenericHeader';
import { IconButton } from '../IconButton';
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
  const chatOptionsSheetRef = useRef<ChatOptionsSheetMethods>(null);

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
              <IconButton onPress={goToSearch}>
                <Search />
              </IconButton>
            )}
            {showMenuButton && (
              <IconButton onPress={handlePressOverflowMenu}>
                <Dots />
              </IconButton>
            )}
          </>
        }
      />
      <ChatOptionsSheet />
    </>
  );
}
