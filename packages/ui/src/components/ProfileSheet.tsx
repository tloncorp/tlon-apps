import Clipboard from '@react-native-clipboard/clipboard';
import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
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
  currentUserIsAdmin,
  groupIsOpen,
  userIsBanned,
  onPressBan,
  onPressUnban,
  onPressKick,
}: {
  contact?: db.Contact;
  contactId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserIsAdmin?: boolean;
  groupIsOpen?: boolean;
  userIsBanned?: boolean;
  onPressKick?: () => void;
  onPressBan?: () => void;
  onPressUnban?: () => void;
}) {
  const currentUserId = useCurrentUserId();
  const coverSize =
    Dimensions.get('window').width / 2 - getTokens().space.$xl.val * 2;

  const handleCopyName = useCallback(() => {
    Clipboard.setString(contactId);
    onOpenChange(false);
  }, [contactId, onOpenChange]);

  const { onPressGoToDm } = useNavigation();

  const handleBlock = useCallback(() => {
    if (contact && contact.isBlocked) {
      store.unblockUser(contactId);
    } else {
      store.blockUser(contactId);
    }
    onOpenChange(false);
  }, [contact, contactId, onOpenChange]);

  const handleGoToDm = useCallback(async () => {
    onPressGoToDm?.([contactId]);
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
          {currentUserId !== contactId && (
            <ProfileButton hero label="Message" onPress={handleGoToDm} />
          )}
          <ProfileButton secondary label="Copy Name" onPress={handleCopyName} />
          {currentUserIsAdmin && currentUserId !== contactId && (
            <>
              <ProfileButton
                secondary
                label="Kick User"
                onPress={() => {
                  onPressKick?.();
                  onOpenChange(false);
                }}
              />
              {groupIsOpen ? (
                userIsBanned ? (
                  <ProfileButton
                    secondary
                    label="Unban User"
                    onPress={() => {
                      onPressUnban?.();
                      onOpenChange(false);
                    }}
                  />
                ) : (
                  <ProfileButton
                    secondary
                    label="Ban User"
                    onPress={() => {
                      onPressBan?.();
                      onOpenChange(false);
                    }}
                  />
                )
              ) : null}
            </>
          )}
          {currentUserId !== contactId && (
            <ProfileButton
              secondary
              label={contact?.isBlocked ? 'Unblock' : 'Block'}
              onPress={handleBlock}
            />
          )}
          {currentUserIsAdmin && currentUserId !== contactId && (
            <Text paddingHorizontal="$2xl" fontSize="$s">
              Visit your group on desktop to manage roles.
            </Text>
          )}
        </YStack>
      </YStack>
    </ActionSheet>
  );
}
