import * as db from 'packages/shared/dist/db';
import { useCallback, useMemo, useState } from 'react';
import { SectionList } from 'react-native';

import { ContactsProvider } from '../contexts';
import { CurrentUserProvider } from '../contexts/currentUser';
import { View } from '../core';
import { ContactList } from './ContactList';
import { GenericHeader } from './GenericHeader';
import { ProfileSheet } from './ProfileSheet';
import { SectionListHeader } from './SectionList';

export function GroupMembersScreenView({
  goBack,
  members,
  roles,
  currentUserId,
  onPressKick,
  onPressBan,
}: {
  goBack: () => void;
  members: db.ChatMember[];
  roles: db.GroupRole[];
  currentUserId: string;
  onPressKick: (contactId: string) => void;
  onPressBan: (contactId: string) => void;
}) {
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const contacts = useMemo(
    () =>
      members
        .filter((m) => m.contact !== undefined && m.contact !== null)
        .map((m) => m.contact!),
    [members]
  );

  const membersByRole = useMemo(
    () =>
      members.reduce<Record<string, db.ChatMember[]>>((acc, m) => {
        if (m.roles !== undefined && m.roles !== null) {
          m.roles.forEach((role) => {
            if (acc[role.roleId] === undefined) {
              acc[role.roleId] = [];
            }
            acc[role.roleId].push(m);
          });
        }
        return acc;
      }, {}),
    [members]
  );

  const membersWithoutRoles = members.filter(
    (m) => m.roles?.length === 0 || m.roles === null
  );

  const sectionedData = useMemo(
    () =>
      Object.keys(membersByRole)
        .map((role) => ({
          title: role,
          data: membersByRole[role],
        }))
        .concat(
          membersWithoutRoles.length > 0
            ? [
                {
                  title: 'Everyone Else',
                  data: membersWithoutRoles,
                },
              ]
            : []
        ),
    [membersByRole, membersWithoutRoles]
  );

  const keyExtractor = useCallback((item: db.ChatMember) => item.contactId, []);

  const renderItem = useCallback(
    ({ item }: { item: db.ChatMember }) => (
      <ContactList.Item
        contactId={item.contactId}
        showNickname
        size="$4xl"
        onPress={() => {
          console.log('pressed', item.contactId);
          setSelectedContact(item.contactId);
        }}
      />
    ),
    []
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: { title: string } }) => (
      <SectionListHeader>
        <SectionListHeader.Text>
          {roles.find((r) => r.id === section.title)?.title}
        </SectionListHeader.Text>
      </SectionListHeader>
    ),
    [roles]
  );

  const currentUserIsAdmin = useMemo(
    () =>
      members.some(
        (m) =>
          m.contactId === currentUserId &&
          m.roles !== undefined &&
          m.roles !== null &&
          m.roles.some((r) => r.roleId === 'admin')
      ),
    [members, currentUserId]
  );

  return (
    <CurrentUserProvider currentUserId={currentUserId}>
      <ContactsProvider contacts={contacts}>
        <View backgroundColor="$background" flex={1}>
          <GenericHeader title="Members" goBack={goBack} />
          <View padding="$l">
            <SectionList
              sections={sectionedData}
              keyExtractor={keyExtractor}
              maxToRenderPerBatch={6}
              initialNumToRender={11}
              windowSize={2}
              renderItem={renderItem}
              renderSectionHeader={renderSectionHeader}
              stickySectionHeadersEnabled={false}
            />
          </View>
        </View>
        {selectedContact !== null && (
          <ProfileSheet
            open={true}
            currentUserIsAdmin={currentUserIsAdmin}
            onOpenChange={(open) => {
              if (!open) {
                setSelectedContact(null);
              }
            }}
            contactId={selectedContact}
            contact={contacts.find((c) => c.id === selectedContact)}
            onPressKick={() => onPressKick(selectedContact)}
            onPressBan={() => onPressBan(selectedContact)}
          />
        )}
      </ContactsProvider>
    </CurrentUserProvider>
  );
}
