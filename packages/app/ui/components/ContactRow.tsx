import * as db from '@tloncorp/shared/db';
import { Icon } from '@tloncorp/ui';
import { Pressable } from '@tloncorp/ui';
import React, { useCallback } from 'react';
import { ListItemProps } from 'tamagui';
import { View, XStack } from 'tamagui';

import { triggerHaptic } from '../utils';
import { ContactName } from './ContactNameV2';
import { ListItem } from './ListItem';

function ContactRowItemRaw({
  contact,
  selected = false,
  selectable = false,
  immutable = false,
  disabled = false,
  disabledReason,
  onPress,
  pressStyle,
  backgroundColor,
  ...rest
}: {
  contact: db.Contact;
  onPress: (id: string) => void;
  selectable?: boolean;
  selected?: boolean;
  immutable?: boolean;
  disabled?: boolean;
  disabledReason?: string;
} & Omit<ListItemProps, 'onPress'>) {
  const handlePress = useCallback(
    (id: string) => () => {
      if (disabled) return;
      onPress(id);
      if (!selectable || !selected) {
        triggerHaptic('baseButtonClick');
      }
    },
    [onPress, selectable, selected, disabled]
  );

  return (
    <Pressable
      backgroundColor={backgroundColor}
      pressStyle={disabled ? undefined : pressStyle}
      borderRadius="$xl"
      disabled={disabled}
      onPress={disabled ? undefined : handlePress(contact.id)}
      testID="ContactRow"
      opacity={disabled ? 0.4 : 1}
    >
      <ListItem {...rest}>
        <ListItem.ContactIcon contactId={contact.id} />
        <ListItem.MainContent>
          <ListItem.Title>
            <ContactName contactId={contact.id} mode="auto" />
          </ListItem.Title>
          {disabled && disabledReason ? (
            <ListItem.Subtitle color="$negativeActionText">
              {disabledReason}
            </ListItem.Subtitle>
          ) : (
            contact?.nickname && (
              <ListItem.Subtitle>
                <ContactName
                  contactId={contact.id}
                  mode="contactId"
                  expandLongIds
                />
              </ListItem.Subtitle>
            )
          )}
        </ListItem.MainContent>
        {selectable && (
          <ListItem.EndContent>
            <View
              justifyContent="center"
              alignItems="center"
              height="$4xl"
              width="$4xl"
            >
              {selected || immutable ? (
                <Icon
                  type="Checkmark"
                  size="$xl"
                  color={immutable ? '$blue' : undefined}
                />
              ) : (
                <View
                  borderWidth={1}
                  borderRadius="$4xl"
                  borderColor="$tertiaryText"
                  opacity={0.6}
                  height="$3xl"
                  width="$3xl"
                />
              )}
            </View>
          </ListItem.EndContent>
        )}
      </ListItem>
    </Pressable>
  );
}
export const ContactRow = React.memo(ContactRowItemRaw);
