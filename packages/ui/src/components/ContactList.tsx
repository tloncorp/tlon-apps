import * as db from '@tloncorp/shared/dist/db';
import { ComponentProps, PropsWithChildren } from 'react';
import { styled, withStaticProperties } from 'tamagui';

import { YStack } from '../core';
import ContactName from './ContactName';
import { ListItem } from './ListItem';

const ContactListItem = ({
  contact,
  onPress,
  onLongPress,
  showNickname = false,
  showUserId = false,
  full = false,
  showIcon = true,
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
    {showIcon && (
      <ListItem.AvatarIcon
        size="$2xl"
        width="$2xl"
        height="$2xl"
        contactId={contact.id}
        contact={contact}
      />
    )}
    <ListItem.Title>
      <ContactName
        matchText={matchText}
        showNickname={showNickname}
        showUserId={showUserId}
        full={full}
        userId={contact.id}
      />
    </ListItem.Title>
  </ListItem>
);

const ContactListFrame = styled(YStack, {
  gap: '$s',
  padding: '$l',
  borderRadius: '$l',
  backgroundColor: '$background',
  borderWidth: 1,
  borderColor: '$tertiaryText',
  pressStyle: {
    backgroundColor: '$positiveBackground',
  },
});

const ContactListFrameComponent = ({ children }: PropsWithChildren) => {
  return <ContactListFrame>{children}</ContactListFrame>;
};

export const ContactList = withStaticProperties(ContactListFrameComponent, {
  Item: ContactListItem,
});
