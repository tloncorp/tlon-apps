import Clipboard from '@react-native-clipboard/clipboard';
import * as db from '@tloncorp/shared/dist/db';
import { useCallback } from 'react';
import { Dimensions } from 'react-native';
import { getTokens } from 'tamagui';

import { useNavigation } from '../contexts';
import { Text, View, YStack } from '../core';
import { ActionSheet } from './ActionSheet';
import { Button } from './Button';
import ProfileCover from './ProfileCover';
import ProfileRow from './ProfileRow';

function ProfileButton({
  label,
  onPress,
  hero,
  secondary,
}: {
  label: string;
  onPress: () => void;
  hero?: boolean;
  secondary?: boolean;
}) {
  return (
    <Button hero={hero} secondary={secondary} onPress={onPress}>
      <Button.Text>{label}</Button.Text>
    </Button>
  );
}

export function ProfileSheet({
  contact,
  contactId,
  onOpenChange,
  open,
}: {
  contact: db.Contact;
  contactId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const coverSize =
    Dimensions.get('window').width / 2 - getTokens().space.$xl.val * 2;

  const handleCopyName = useCallback(() => {
    Clipboard.setString(contactId);
    onOpenChange(false);
  }, [contactId, onOpenChange]);

  const { onPressGoToDm } = useNavigation();

  const handleBlock = useCallback(() => {
    console.log('block not yet implemented', contactId);
    onOpenChange(false);
  }, [contactId, onOpenChange]);

  const handleGoToDm = useCallback(async () => {
    onPressGoToDm([contactId]);
    onOpenChange(false);
  }, [contactId, onPressGoToDm, onOpenChange]);

  return (
    <ActionSheet open={open} onOpenChange={onOpenChange}>
      <YStack gap="$xl">
        {contact.coverImage ? (
          <ProfileCover uri={contact.coverImage}>
            <View height={coverSize} justifyContent="flex-end">
              <ProfileRow
                contactId={contactId}
                contact={contact}
                debugMessage="ProfileCard"
              />
            </View>
          </ProfileCover>
        ) : (
          <ProfileRow
            contactId={contactId}
            contact={contact}
            debugMessage="ProfileCard"
            dark
          />
        )}
        <Text paddingHorizontal="$2xl" fontSize="$l">
          {contact.bio}
        </Text>
        <YStack gap="$m">
          <ProfileButton hero label="Message" onPress={handleGoToDm} />
          <ProfileButton secondary label="Copy Name" onPress={handleCopyName} />
          <ProfileButton
            secondary
            label="Block"
            // TODO: blocking is not implemented yet
            onPress={handleBlock}
          />
        </YStack>
      </YStack>
    </ActionSheet>
  );
}
