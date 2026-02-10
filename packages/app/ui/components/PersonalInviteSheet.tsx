import * as db from '@tloncorp/shared/db';
import { Pressable, Text } from '@tloncorp/ui';
import { useMemo, useRef } from 'react';
import QRCode from 'react-qr-code';
import { View, YStack, useTheme } from 'tamagui';

import { useStore } from '../contexts';
import { ActionSheet } from './ActionSheet';
import { ListItem } from './ListItem';
import { PersonalInviteButton } from './PersonalInviteButton';

export function PersonalInviteSheet({
  open,
  onOpenChange,
  onPressInviteFriends,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPressInviteFriends: () => void;
}) {
  const hasOpenedRef = useRef(false);
  if (open) {
    hasOpenedRef.current = true;
  }

  return (
    <ActionSheet
      open={open}
      onOpenChange={onOpenChange}
      snapPointsMode="fit"
      modal
    >
      <ActionSheet.SimpleHeader title="Invite Friends to Tlon Messenger" />
      <ActionSheet.Content flex={1} paddingBottom={0}>
        <ActionSheet.ScrollableContent flex={1}>
          {hasOpenedRef.current && (
            <PersonalInviteSheetContent
              onPressInviteFriends={onPressInviteFriends}
            />
          )}
        </ActionSheet.ScrollableContent>
      </ActionSheet.Content>
    </ActionSheet>
  );
}

const PersonalInviteSheetContent = ({
  onPressInviteFriends,
}: {
  onPressInviteFriends: () => void;
}) => {
  const store = useStore();
  const inviteLink = db.personalInviteLink.useValue();
  const theme = useTheme();

  const { data: systemContacts } = store.useSystemContacts();
  const hasSystemContacts = useMemo(() => {
    return systemContacts && systemContacts.length > 0;
  }, [systemContacts]);

  return (
    <YStack flex={1} paddingHorizontal={40} gap="$m" paddingBottom="$5xl">
      <Text size="$label/m" color="$secondaryText" marginBottom="$2xl">
        Anyone you invite will skip the waitlist and be added to your contacts.
        You&apos;ll receive a DM when they join.
      </Text>
      <View width="100%" display="flex" alignItems="center" marginBottom="$3xl">
        {inviteLink && (
          <QRCode
            value={inviteLink}
            size={200}
            fgColor={theme.primaryText.val}
            bgColor="transparent"
          />
        )}
      </View>
      <YStack paddingBottom="$l" gap="$m">
        <PersonalInviteButton />
        {hasSystemContacts && (
          <Pressable onPress={() => onPressInviteFriends()}>
            <ListItem backgroundColor="$secondaryBackground">
              <ListItem.SystemIcon icon="AddPerson" />
              <ListItem.MainContent>
                <ListItem.Title>Invite your friends</ListItem.Title>
              </ListItem.MainContent>
              <ListItem.EndContent>
                <ListItem.SystemIcon icon="ChevronRight" />
              </ListItem.EndContent>
            </ListItem>
          </Pressable>
        )}
      </YStack>
    </YStack>
  );
};
