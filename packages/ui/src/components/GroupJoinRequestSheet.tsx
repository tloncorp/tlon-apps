import Clipboard from '@react-native-clipboard/clipboard';
import * as db from '@tloncorp/shared/dist/db';
import { useCallback } from 'react';
import { Dimensions } from 'react-native';
import { getTokens } from 'tamagui';

import { useNavigation } from '../contexts';
import { useCurrentUserId } from '../contexts/appDataContext';
import { Text, View, YStack } from '../core';
import { ActionSheet } from './ActionSheet';
import { Button } from './Button';
import ProfileCover from './ProfileCover';
import ProfileRow from './ProfileRow';

export function GroupJoinRequestSheet({
  contact,
  contactId,
  currentUserIsAdmin,
  onOpenChange,
  open,
  onPressAccept,
  onPressReject,
}: {
  contact?: db.Contact;
  contactId: string;
  currentUserIsAdmin?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPressAccept: () => void;
  onPressReject: () => void;
}) {
  const currentUserId = useCurrentUserId();
  const coverSize =
    Dimensions.get('window').width / 2 - getTokens().space.$xl.val * 2;

  const handleCopyName = useCallback(() => {
    Clipboard.setString(contactId);
    onOpenChange(false);
  }, [contactId, onOpenChange]);

  const { onPressGoToDm } = useNavigation();

  const handleGoToDm = useCallback(async () => {
    onPressGoToDm([contactId]);
    onOpenChange(false);
  }, [contactId, onPressGoToDm, onOpenChange]);

  return (
    <ActionSheet open={open} onOpenChange={onOpenChange}>
      <YStack gap="$xl">
        {contact?.coverImage ? (
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
          {contact?.bio}
        </Text>
        <YStack gap="$m">
          {currentUserIsAdmin && (
            <>
              <Button
                hero
                onPress={() => {
                  onPressAccept();
                  onOpenChange(false);
                }}
              >
                <Button.Text>Accept Request</Button.Text>
              </Button>
              <Button
                heroDestructive
                onPress={() => {
                  onPressReject();
                  onOpenChange(false);
                }}
              >
                <Button.Text>Reject Request</Button.Text>
              </Button>
            </>
          )}
          {currentUserId !== contactId && (
            <Button secondary onPress={handleGoToDm}>
              <Button.Text>Message</Button.Text>
            </Button>
          )}
          <Button secondary onPress={handleCopyName}>
            <Button.Text>Copy Name</Button.Text>
          </Button>
        </YStack>
      </YStack>
    </ActionSheet>
  );
}
