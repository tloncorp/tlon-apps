import * as db from '@tloncorp/shared/dist/db';
import { ComponentProps } from 'react';

import ContactName from '../ContactName';
import { ListItem } from './ListItem';

export const ContactListItem = ({
  contact,
  onPress,
  onLongPress,
  showNickname = false,
  showUserId = false,
  full = false,
  showIcon = true,
  showEndContent = false,
  endContent,
  matchText,
  ...props
}: {
  contact: db.Contact;
  onPress?: (contact: db.Contact) => void;
  onLongPress?: () => void;
  showNickname?: boolean;
  showUserId?: boolean;
  full?: boolean;
  showIcon?: boolean;
  showEndContent?: boolean;
  endContent?: React.ReactNode;
  matchText?: string;
} & ComponentProps<typeof ListItem>) => (
  <ListItem
    onPress={() => onPress?.(contact)}
    onLongPress={onLongPress}
    alignItems="center"
    justifyContent="flex-start"
    padding="$s"
    {...props}
  >
    {showIcon && <ListItem.ContactIcon size="$2xl" contactId={contact.id} />}
    <ListItem.Title>
      <ContactName
        matchText={matchText}
        showNickname={showNickname}
        showUserId={showUserId}
        full={full}
        userId={contact.id}
      />
    </ListItem.Title>
    {showEndContent && (
      <ListItem.EndContent flexGrow={1} justifyContent="flex-end">
        {endContent}
      </ListItem.EndContent>
    )}
  </ListItem>
);
