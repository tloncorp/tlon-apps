import * as db from '@tloncorp/shared/dist/db';
import { GroupPrivacy } from '@tloncorp/shared/dist/db/schema';
import { useCallback, useMemo, useState } from 'react';
import { SectionList } from 'react-native';
import { View } from 'tamagui';

import { AppDataContextProvider } from '../contexts/appDataContext';
import { ContactList } from './ContactList';
import { GenericHeader } from './GenericHeader';
import { ProfileSheet } from './ProfileSheet';
import { SectionListHeader } from './SectionList';

export function GroupMembersScreenView({
  goBack,
  members,
  roles,
  bannedUsers,
  groupPrivacyType,
  currentUserId,
  onPressKick,
  onPressBan,
  onPressUnban,
}: {
  goBack: () => void;
  members: db.ChatMember[];
  roles: db.GroupRole[];
  currentUserId: string;
  bannedUsers: db.GroupMemberBan[];
  groupPrivacyType: GroupPrivacy;
  onPressKick: (contactId: string) => void;
  onPressBan: (contactId: string) => void;
  onPressUnban: (contactId: string) => void;
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

  const bannedUserData: db.ChatMember[] = useMemo(
    () =>
      bannedUsers.map((b) => ({
        contactId: b.contactId,
        roles: null,
        contact: contacts.find((c) => c.id === b.contactId),
        membershipType: 'group',
      })),
    [bannedUsers, contacts]
  );

  const sectionedData = useMemo(
    () =>
      Object.keys(membersByRole)
        .map((role) => ({
          title: role,
          data: membersByRole[role],
        }))
        .concat(
          bannedUserData.length > 0
            ? [
                {
                  title: 'Banned Users',
                  data: bannedUserData,
                },
              ]
            : []
        )
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
    [membersByRole, membersWithoutRoles, bannedUserData]
  );

  const keyExtractor = useCallback((item: db.ChatMember) => item.contactId, []);

  const renderItem = useCallback(
    ({ item }: { item: db.ChatMember }) => (
      <ContactList.Item
        contactId={item.contactId}
        showNickname
        size="$4xl"
        onPress={() => {
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
          {roles.find((r) => r.id === section.title)?.title ?? section.title}
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
    <AppDataContextProvider contacts={contacts} currentUserId={currentUserId}>
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
          userIsBanned={bannedUsers.some(
            (b) => b.contactId === selectedContact
          )}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedContact(null);
            }
          }}
          groupIsOpen={groupPrivacyType === 'public'}
          contactId={selectedContact}
          contact={contacts.find((c) => c.id === selectedContact)}
          onPressKick={() => onPressKick(selectedContact)}
          onPressBan={() => onPressBan(selectedContact)}
          onPressUnban={() => onPressUnban(selectedContact)}
        />
      )}
    </AppDataContextProvider>
  );
}
