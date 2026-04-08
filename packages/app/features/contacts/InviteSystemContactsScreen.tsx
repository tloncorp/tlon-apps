import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/db';
import * as domain from '@tloncorp/shared/domain';
import * as store from '@tloncorp/shared/store';
import { useCallback, useMemo, useState } from 'react';
import { Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, View } from 'tamagui';

import type { RootStackParamList } from '../../navigation/types';
import {
  BlockSectionList,
  Icon,
  ScreenHeader,
  SearchBar,
  SystemContactListItem,
  triggerHaptic,
  useInviteSystemContacts,
} from '../../ui';
import { Badge } from '../../ui/components/Badge';
import {
  sortSystemContactsIntoSections,
  useSystemContactSearch,
} from '../../ui/hooks/systemContactSorters';

type Props = NativeStackScreenProps<RootStackParamList, 'InviteSystemContacts'>;

export function InviteSystemContactsScreen(props: Props) {
  const inviteSystemContacts = useInviteSystemContacts();
  const { data: systemContacts } = store.useSystemContacts();
  const [selectedRecipients, setSelectedRecipients] = useState<
    db.SystemContact[]
  >([]);
  const insets = useSafeAreaInsets();

  const { displayContacts, handleSearch } = useSystemContactSearch(
    systemContacts ?? []
  );

  const alphabeticalContactSections = useMemo(
    () => sortSystemContactsIntoSections(displayContacts),
    [displayContacts]
  );

  const handleItemPress = useCallback(
    (item: db.SystemContact) => {
      if (selectedRecipients.some((contact) => contact.id === item.id)) {
        triggerHaptic('baseButtonClick');
        setSelectedRecipients((prev) =>
          prev.filter((contact) => contact.id !== item.id)
        );
      } else {
        // max 10 recipients
        if (selectedRecipients.length >= 10) {
          triggerHaptic('error');
          return;
        }
        triggerHaptic('baseButtonClick');
        setSelectedRecipients((prev) => [...prev, item]);
      }
    },
    [selectedRecipients]
  );

  const renderItem = useCallback(
    ({ item }: { item: db.SystemContact }) => {
      return (
        <SystemIconRow
          item={item}
          selectedSet={selectedRecipients}
          onPress={handleItemPress}
        />
      );
    },
    [selectedRecipients, handleItemPress]
  );

  const handleDone = useCallback(async () => {
    if (!selectedRecipients.length) {
      triggerHaptic('error');
      return;
    }

    const firstRecipient = selectedRecipients[0];
    const recipientsType = firstRecipient.phoneNumber ? 'sms' : 'email';
    const recipients = selectedRecipients
      .map((contact) =>
        recipientsType === 'sms' ? contact.phoneNumber : contact.email
      )
      .filter(Boolean) as string[];
    const inviteLink = await db.personalInviteLink.getValue();

    if (!inviteLink || !recipients.length) {
      triggerHaptic('error');
      return;
    }

    const params: domain.SystemContactInviteParams = {
      type: recipientsType,
      recipients,
      invite: {
        message: domain.SystemContactInviteMessages.Personal,
        link: inviteLink,
      },
    };

    const didSend = await inviteSystemContacts?.(params);
    if (didSend) {
      await store.recordSentInvites(
        domain.InvitedToPersonalKey,
        selectedRecipients
      );
      setSelectedRecipients([]);
      props.navigation.goBack();
    }
  }, [inviteSystemContacts, props.navigation, selectedRecipients]);

  return (
    <View flex={1}>
      <ScreenHeader
        title="Invite your friends"
        leftControls={
          <ScreenHeader.TextButton onPress={() => props.navigation.goBack()}>
            Cancel
          </ScreenHeader.TextButton>
        }
        rightControls={
          selectedRecipients.length > 0 ? (
            <ScreenHeader.TextButton
              color="$positiveActionText"
              onPress={handleDone}
            >
              Invite
            </ScreenHeader.TextButton>
          ) : null
        }
      />
      <View flex={1} onTouchStart={Keyboard.dismiss} marginTop="$l">
        <SearchBar
          onChangeQuery={handleSearch}
          paddingHorizontal="$xl"
          height="$4xl"
          marginBottom="$s"
          flexGrow={0}
          debounceTime={100}
          placeholder="Search contacts"
          inputProps={{
            spellCheck: false,
            autoCapitalize: 'none',
            autoComplete: 'off',
            flex: 1,
          }}
        />
        <BlockSectionList
          sections={alphabeticalContactSections}
          renderItem={renderItem}
          style={{
            flex: 1,
            paddingTop: 8,
          }}
          contentContainerStyle={{
            marginHorizontal: 14,
            paddingBottom: insets.bottom,
          }}
          stickySectionHeadersEnabled={false}
          stickyHeaderHiddenOnScroll={false}
        ></BlockSectionList>
      </View>
    </View>
  );
}

export function SystemIconRow({
  item,
  selectedSet,
  onPress,
}: {
  item: db.SystemContact;
  selectedSet: db.SystemContact[];
  onPress: (contact: db.SystemContact) => void;
}) {
  const contactType = useMemo(() => {
    return item.phoneNumber ? 'sms' : 'email';
  }, [item.phoneNumber]);

  const selected = useMemo(() => {
    return selectedSet.some((recipient) => recipient.id === item.id);
  }, [item.id, selectedSet]);

  const wrongTypeGivenRecipients = useMemo(() => {
    if (!selectedSet.length) {
      return false;
    }

    const firstRecipient = selectedSet[0];
    const recipientsType = firstRecipient.phoneNumber ? 'sms' : 'email';
    return contactType !== recipientsType;
  }, [contactType, selectedSet]);

  // don't allow selecting anyone who was already sent a personal invite in the last 2 weeks
  const previouslyInvited = useMemo(() => {
    const LAST_INVITE_THRESHOLD = 1000 * 60 * 60 * 24 * 14; // 14 days
    return item.sentInvites?.some(
      (invite) =>
        invite.invitedAt &&
        invite.invitedAt > Date.now() - LAST_INVITE_THRESHOLD &&
        invite.invitedTo === domain.InvitedToPersonalKey
    );
  }, [item]);

  const handlePress = useCallback(() => {
    if (previouslyInvited || wrongTypeGivenRecipients) {
      triggerHaptic('error');
      return;
    }
    onPress(item);
  }, [onPress, item, previouslyInvited, wrongTypeGivenRecipients]);

  return (
    <BlockSectionList.ItemWrapper>
      <SystemContactListItem
        systemContact={item}
        onPress={handlePress}
        backgroundColor="$secondaryBackground"
        iconProps={{ backgroundColor: '$border' }}
        showEndContent
        endContent={
          <Stack justifyContent="center" alignItems="center" height="$4xl">
            {previouslyInvited ? (
              <Badge
                text="Invited"
                type="tertiary"
                position="relative"
                left={16} // manually adjust to align with checkmarks
              />
            ) : selected ? (
              <Icon type="Checkmark" size="$xl" />
            ) : !wrongTypeGivenRecipients ? (
              <View
                borderWidth={1}
                borderRadius="$4xl"
                borderColor="$tertiaryText"
                opacity={0.6}
                height="$3xl"
                width="$3xl"
              />
            ) : null}
          </Stack>
        }
      />
    </BlockSectionList.ItemWrapper>
  );
}
