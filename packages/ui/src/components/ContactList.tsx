import { ComponentProps, PropsWithChildren } from 'react';
import { styled, withStaticProperties } from 'tamagui';

import { YStack } from '../core';
import { ContactListItem } from './ListItem/ContactListItem';

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

const ContactListFrameComponent = ({
  children,
  ...rest
}: PropsWithChildren<ComponentProps<typeof ContactListFrame>>) => {
  return <ContactListFrame {...rest}>{children}</ContactListFrame>;
};

export const ContactList = withStaticProperties(ContactListFrameComponent, {
  Item: ContactListItem,
});
