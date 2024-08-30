import * as db from '@tloncorp/shared/dist/db';
import { ComponentProps } from 'react';
import { SizableText } from 'tamagui';

import { AvatarProps } from '../Avatar';
import ContactName from '../ContactName';
import { ListItem } from './ListItem';
import { useBoundHandler } from './listItemUtils';

export const ContactListItem = ({
  contactId,
  onPress,
  onLongPress,
  showNickname = false,
  showUserId = false,
  full = false,
  showIcon = true,
  showEndContent = false,
  endContent,
  matchText,
  size = '$2xl',
  ...props
}: {
  contactId: string;
  onPress?: (contactId: string) => void;
  onLongPress?: (contactId: string) => void;
  showNickname?: boolean;
  showUserId?: boolean;
  full?: boolean;
  showIcon?: boolean;
  showEndContent?: boolean;
  endContent?: React.ReactNode;
  matchText?: string;
} & Omit<ComponentProps<typeof ListItem>, 'onPress' | 'onLongPress'> &
  Pick<AvatarProps, 'size'>) => {
  const handlePress = useBoundHandler(contactId, onPress);
  const handleLongPress = useBoundHandler(contactId, onLongPress);

  return (
    <ListItem
      onPress={handlePress}
      onLongPress={handleLongPress}
      alignItems="center"
      justifyContent="flex-start"
      {...props}
    >
      {showIcon && <ListItem.ContactIcon size={size} contactId={contactId} />}
      <ListItem.MainContent>
        <ListItem.Title>
          <ContactName
            matchText={matchText}
            showNickname={showNickname}
            showUserId={!showNickname && showUserId}
            full={full}
            userId={contactId}
          />
        </ListItem.Title>
        {showUserId && showNickname ? (
          <ListItem.Subtitle>{contactId}</ListItem.Subtitle>
        ) : null}
      </ListItem.MainContent>
      {showEndContent && (
        <ListItem.EndContent flexGrow={1} justifyContent="flex-end">
          {endContent}
        </ListItem.EndContent>
      )}
    </ListItem>
  );
};
