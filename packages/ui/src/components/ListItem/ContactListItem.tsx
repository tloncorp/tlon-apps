import * as db from '@tloncorp/shared/dist/db';
import { ComponentProps } from 'react';

import { AvatarProps } from '../Avatar';
import ContactName from '../ContactName';
import { ListItem } from './ListItem';

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
  onPress?: () => void;
  onLongPress?: () => void;
  showNickname?: boolean;
  showUserId?: boolean;
  full?: boolean;
  showIcon?: boolean;
  showEndContent?: boolean;
  endContent?: React.ReactNode;
  matchText?: string;
} & ComponentProps<typeof ListItem> &
  Pick<AvatarProps, 'size'>) => (
  <ListItem
    onPress={() => onPress?.()}
    onLongPress={onLongPress}
    alignItems="center"
    justifyContent="flex-start"
    padding="$s"
    {...props}
  >
    {showIcon && <ListItem.ContactIcon size={size} contactId={contactId} />}
    <ListItem.Title>
      <ContactName
        matchText={matchText}
        showNickname={showNickname}
        showUserId={showUserId}
        full={full}
        userId={contactId}
      />
    </ListItem.Title>
    {showEndContent && (
      <ListItem.EndContent flexGrow={1} justifyContent="flex-end">
        {endContent}
      </ListItem.EndContent>
    )}
  </ListItem>
);
