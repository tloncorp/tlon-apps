import * as db from '@tloncorp/shared/dist/db';
import { useCallback, useRef } from 'react';

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
            {showAddButton && (
              <Button
                backgroundColor="unset"
                borderColor="transparent"
                onPress={onPressAddButton}
              >
                <Icon type="Add" />
              </Button>
            )}
            {showMenuButton && (
              <Button
                backgroundColor="unset"
                borderColor="transparent"
                onPress={handlePressOverflowMenu}
              >
                <Icon type="Overflow" />
              </Button>
            )}
          </>
        }
      />
      <ChatOptionsSheet ref={chatOptionsSheetRef} />
    </>
  );
}
