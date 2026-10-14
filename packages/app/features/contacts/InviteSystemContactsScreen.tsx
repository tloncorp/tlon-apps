import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/db';
import * as domain from '@tloncorp/shared/domain';
import * as store from '@tloncorp/shared/store';
import { useCallback, useMemo, useState } from 'react';

import type { RootStackParamList } from '../../navigation/types';
import { triggerHaptic, useInviteSystemContacts } from '../../ui';
import {
  type SettingsRowModel,
  type SettingsSectionModel,
  SettingsListScreenView,
} from '../../ui/components/SettingsList';
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
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(pageSize);

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

  const sections = useMemo((): SettingsSectionModel[] => {
    if (!displayContacts.length) {
      return [
        {
          key: 'none',
          rows: [
            {
              key: 'none',
              title: query.trim()
                ? 'No one matches that search.'
                : 'No contacts to invite.',
            },
          ],
        },
      ];
    }
    // The native lists draw every row they are given, so a long address book
    // is shown a page at a time.
    let budget = limit;
    const shown: SettingsSectionModel[] = [];
    for (const section of alphabeticalContactSections) {
      if (budget <= 0) break;
      const contacts = section.data.slice(0, budget);
      budget -= contacts.length;
      shown.push({
        key: section.label,
        title: section.label,
        rows: contacts.map((contact) =>
          contactRow(contact, selectedRecipients, handleItemPress)
        ),
      });
    }
    const hidden = displayContacts.length - limit;
    return [
      ...shown,
      {
        key: 'more',
        footer:
          'Choose up to 10 people. One invite goes by text or by email, not both.',
        rows:
          hidden > 0
            ? [
                {
                  key: 'more',
                  title: `Show ${Math.min(hidden, pageSize)} more`,
                  action: true,
                  onPress: () => setLimit((current) => current + pageSize),
                },
              ]
            : [],
      },
    ];
  }, [
    alphabeticalContactSections,
    displayContacts.length,
    handleItemPress,
    limit,
    query,
    selectedRecipients,
  ]);

  return (
    <SettingsListScreenView
      title="Invite your friends"
      sections={sections}
      onBackPressed={() => props.navigation.goBack()}
      search={{
        value: query,
        onChangeText: (text) => {
          setQuery(text);
          handleSearch(text);
        },
        placeholder: 'Search contacts',
      }}
      rightActions={[
        {
          id: 'InviteSystemContactsSend',
          text: selectedRecipients.length
            ? `Invite (${selectedRecipients.length})`
            : 'Invite',
          tint: '$positiveActionText',
          disabled: selectedRecipients.length === 0,
          onPress: handleDone,
          testID: 'InviteSystemContactsSend',
        },
      ]}
    />
  );
}

const pageSize = 100;
// Someone sent a personal invite in the last two weeks isn't offered again.
const reinviteAfter = 1000 * 60 * 60 * 24 * 14;

function contactRow(
  contact: db.SystemContact,
  selected: db.SystemContact[],
  onPress: (contact: db.SystemContact) => void
): SettingsRowModel {
  const previouslyInvited = contact.sentInvites?.some(
    (invite) =>
      invite.invitedAt &&
      invite.invitedAt > Date.now() - reinviteAfter &&
      invite.invitedTo === domain.InvitedToPersonalKey
  );
  // One invite goes out as a text or as an email, so the first person chosen
  // sets which kind of contact the rest can be.
  const kind = contact.phoneNumber ? 'sms' : 'email';
  const chosenKind = selected[0]
    ? selected[0].phoneNumber
      ? 'sms'
      : 'email'
    : null;
  const isSelected = selected.some((recipient) => recipient.id === contact.id);
  return {
    key: contact.id,
    title: [contact.firstName, contact.lastName].filter(Boolean).join(' '),
    subtitle: contact.phoneNumber
      ? domain.displayablePhoneNumber(contact.phoneNumber)
      : (contact.email ?? undefined),
    value: previouslyInvited ? 'Invited' : undefined,
    selected: isSelected,
    multiple: true,
    disabled:
      previouslyInvited || (!isSelected && !!chosenKind && chosenKind !== kind),
    onPress: () => onPress(contact),
  };
}
