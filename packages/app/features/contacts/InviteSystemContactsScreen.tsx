import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/db';
import * as domain from '@tloncorp/shared/domain';
import * as store from '@tloncorp/shared/store';
import Fuse from 'fuse.js';
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

type Props = NativeStackScreenProps<RootStackParamList, 'InviteSystemContacts'>;

export function InviteSystemContactsScreen(props: Props) {
  const inviteSystemContacts = useInviteSystemContacts();
  const { data: systemContacts } = store.useSystemContacts();
  const [selectedRecipients, setSelectedRecipients] = useState<
    db.SystemContact[]
  >([]);
  const [searchResults, setSearchResults] = useState<db.SystemContact[]>([]);
  const insets = useSafeAreaInsets();

  const searchService = useMemo(() => {
    return new ContactSearchService(systemContacts ?? []);
  }, [systemContacts]);

  const handleSearch = useCallback(
    (query: string) => {
      const results = searchService.search(query);
      setSearchResults(results);
    },
    [searchService]
  );

  const alphabeticalContactSections = useMemo(
    () =>
      sortContactsIntoSections(
        searchResults.length ? searchResults : systemContacts ?? []
      ) as {
        label: string;
        data: db.SystemContact[];
      }[],
    [searchResults, systemContacts]
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

/*
Helper logic — lot of duplication with the db.Contact book, but for the time
being necessary given model differences.
*/
export function sortContactsIntoSections(contacts: db.SystemContact[]) {
  // Create a map to hold contacts grouped by first letter
  const sections: { [key: string]: db.SystemContact[] } = {};

  // Sort contacts into appropriate sections
  contacts.forEach((contact) => {
    // Determine display name and first letter for sorting
    const firstName = contact.firstName || '';
    const lastName = contact.lastName || '';
    const displayName = firstName || lastName;

    // If no name is available, use '#' section
    if (!displayName) {
      sections['#'] = sections['#'] || [];
      sections['#'].push(contact);
      return;
    }

    // Get first letter and convert to uppercase
    const firstLetter = displayName.charAt(0).toUpperCase();

    // Check if the first letter is alphabetical, otherwise use '#'
    const sectionKey = /[A-Z]/.test(firstLetter) ? firstLetter : '#';

    // Initialize the section if it doesn't exist yet
    sections[sectionKey] = sections[sectionKey] || [];

    // Add the contact to the appropriate section
    sections[sectionKey].push(contact);
  });

  // Convert the sections map to an array of section objects
  const sectionArray = Object.keys(sections)
    .sort() // Sort section keys alphabetically
    .map((key) => ({
      label: key,
      data: sections[key].sort((a, b) => {
        // Sort contacts within each section alphabetically
        const nameA = (a.firstName || '') + (a.lastName || '');
        const nameB = (b.firstName || '') + (b.lastName || '');
        return nameA.localeCompare(nameB);
      }),
    }));

  // Move '#' section to the end if it exists
  if (sectionArray.some((section) => section.label === '#')) {
    const hashSection = sectionArray.find((section) => section.label === '#');
    const filteredSections = sectionArray.filter(
      (section) => section.label !== '#'
    );
    return [...filteredSections, hashSection];
  }

  return sectionArray;
}

export class ContactSearchService {
  private fuse: Fuse<db.SystemContact>;

  constructor(contacts: db.SystemContact[]) {
    // Configure Fuse with appropriate options
    const options = {
      keys: ['firstName', 'lastName', 'phoneNumber', 'email'],
      threshold: 0.4, // Lower threshold means more strict matching
      ignoreLocation: true,
      shouldSort: true,
    };

    this.fuse = new Fuse(contacts, options);
  }

  // Search contacts with a query string
  search(query: string): db.SystemContact[] {
    if (!query.trim()) {
      return [];
    }

    return this.fuse.search(query).map((result) => result.item);
  }
}
