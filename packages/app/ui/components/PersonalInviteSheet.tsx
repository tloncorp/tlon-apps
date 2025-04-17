import * as db from '@tloncorp/shared/db';
import { Pressable, Text } from '@tloncorp/ui';
import QRCode from 'react-qr-code';
import { View, YStack, useTheme } from 'tamagui';

import { useStore } from '../contexts';
import { ActionSheet } from './ActionSheet';
import { PrimaryButton } from './Buttons';
import { ListItem, SystemContactListItem } from './ListItem';
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
  const store = useStore();
  const inviteLink = db.personalInviteLink.useValue();
  const theme = useTheme();

  const { data: sysContactShortlist } = store.useSystemContactShortlist();

  return (
    <ActionSheet
      open={open}
      onOpenChange={onOpenChange}
      snapPointsMode="percent"
      snapPoints={[75]}
    >
      <ActionSheet.SimpleHeader title="Invite Friends to TM" />
      <ActionSheet.Content flex={1}>
        <ActionSheet.ScrollableContent flex={1}>
          <View flex={1} paddingHorizontal={40}>
            <Text size="$label/m" color="$secondaryText" marginBottom="$2xl">
              Anyone you invite will skip the waitlist and be added to your
              contacts. You&apos;ll receive a DM when they join.
            </Text>
            <View
              width="100%"
              display="flex"
              alignItems="center"
              marginBottom="$3xl"
            >
              {inviteLink && (
                <QRCode
                  value={inviteLink}
                  size={200}
                  fgColor={theme.primaryText.val}
                  bgColor="transparent"
                />
              )}
            </View>
            <YStack gap="$m">
              <PersonalInviteButton />
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
              {/* <PrimaryButton>Invite Contacts</PrimaryButton> */}
            </YStack>
          </View>
          {/* {sysContactShortlist && sysContactShortlist.length > 0 && (
            <YStack
              marginTop="$3xl"
              marginHorizontal={20}
              backgroundColor="$secondaryBackground"
              borderRadius="$l"
            >
              {sysContactShortlist.map((contact) => (
                <SystemContactListItem
                  // backgroundColor="$secondaryBackground"
                  key={contact.id}
                  systemContact={contact}
                  showInvitedStatus
                  onPress={() => {
                    console.log('pressed!');
                  }}
                />
              ))}
            </YStack>
          )} */}
        </ActionSheet.ScrollableContent>
      </ActionSheet.Content>
    </ActionSheet>
  );
}
