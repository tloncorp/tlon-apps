import { parseGroupId } from '@tloncorp/shared/api';
import * as db from '@tloncorp/shared/db';
import { SectionListHeader } from '@tloncorp/ui';
import { useCallback, useMemo, useState } from 'react';
import { SectionList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, getTokenValue } from 'tamagui';

import { useIsAdmin } from '../utils';
import { ContactList } from './ContactList';
import { GroupJoinRequestSheet } from './GroupJoinRequestSheet';
import { ProfileSheet } from './ProfileSheet';
import { ScreenHeader } from './ScreenHeader';

type GroupPrivacy = db.schema.GroupPrivacy;

export function GroupMembersScreenView({
  goBack,
  members,
  roles,
  groupId,
  bannedUsers,
  joinRequests,
  groupPrivacyType,
  currentUserId,
  onPressKick,
  onPressBan,
  onPressUnban,
  onPressAcceptJoinRequest,
  onPressRejectJoinRequest,
  onPressGoToDm,
  onPressAssignRole,
  onPressRemoveRole,
}: {
  goBack: () => void;
  members: db.ChatMember[];
  roles: db.GroupRole[];
  currentUserId: string;
  groupId: string;
  bannedUsers: db.GroupMemberBan[];
  joinRequests: db.GroupJoinRequest[];
  groupPrivacyType: GroupPrivacy;
  onPressKick: (contactId: string) => void;
  onPressBan: (contactId: string) => void;
  onPressUnban: (contactId: string) => void;
  onPressAcceptJoinRequest: (contactId: string) => void;
  onPressRejectJoinRequest: (contactId: string) => void;
  onPressGoToDm: (contactId: string) => void;
  onPressAssignRole: (contactId: string, roleId: string) => void;
  onPressRemoveRole: (contactId: string, roleId: string) => void;
}) {
  const { bottom } = useSafeAreaInsets();
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const currentUserIsAdmin = useIsAdmin(groupId, currentUserId);
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

  const membersWithoutRoles = members
    .filter((m) => m.status !== 'invited')
    .filter((m) => m.roles?.length === 0 || m.roles === null);

  const invitedMembers = members.filter((m) => m.status === 'invited');

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

  const joinRequestData: db.ChatMember[] = useMemo(
    () =>
      joinRequests.map((r) => ({
        contactId: r.contactId,
        roles: null,
        contact: contacts.find((c) => c.id === r.contactId),
        membershipType: 'group',
      })),
    [joinRequests, contacts]
  );
  const selectedIsRequest = joinRequests.some(
    (request) => request.contactId === selectedContact
  );

  const sectionedData = useMemo(
    () =>
      Object.keys(membersByRole)
        .map((role) => ({
          title: role,
          data: membersByRole[role],
        }))
        .concat(
          joinRequestData.length > 0 && currentUserIsAdmin
            ? [
                {
                  title: 'Join Requests',
                  data: joinRequestData,
                },
              ]
            : []
        )
        .concat(
          invitedMembers.length > 0
            ? [
                {
                  title: 'Invited',
                  data: invitedMembers,
                },
              ]
            : []
        )
        .concat(
          bannedUserData.length > 0 && currentUserIsAdmin
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
    [
      membersByRole,
      joinRequestData,
      bannedUserData,
      membersWithoutRoles,
      invitedMembers,
      currentUserIsAdmin,
    ]
  );

  const keyExtractor = useCallback((item: db.ChatMember) => item.contactId, []);

  const renderItem = useCallback(
    ({ item }: { item: db.ChatMember }) => (
      <ContactList.Item
        contactId={item.contactId}
        showNickname
        size="$4xl"
        onPress={setSelectedContact}
        testID="MemberRow"
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

  const selectedUserRoles = useMemo(
    () =>
      members
        .find((m) => m.contactId === selectedContact)
        ?.roles?.map((r) => r.roleId),
    [members, selectedContact]
  );

  const { host: groupHostId } = parseGroupId(groupId);

  return (
    <>
      <View backgroundColor="$background" flex={1}>
        <ScreenHeader title="Members" backAction={goBack} />
        <SectionList
          sections={sectionedData}
          keyExtractor={keyExtractor}
          maxToRenderPerBatch={6}
          initialNumToRender={11}
          contentContainerStyle={{
            paddingHorizontal: getTokenValue('$l', 'size'),
            paddingBottom: bottom,
          }}
          windowSize={2}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={false}
        />
      </View>
      {selectedContact !== null && !selectedIsRequest && (
        <ProfileSheet
          open={true}
          currentUserIsAdmin={currentUserIsAdmin}
          groupHostId={groupHostId}
          userIsBanned={bannedUsers.some(
            (b) => b.contactId === selectedContact
          )}
          userIsInvited={invitedMembers.some(
            (m) => m.contactId === selectedContact
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
          onPressGoToDm={() => onPressGoToDm(selectedContact)}
          onPressAsignRole={(roleId: string) =>
            onPressAssignRole(selectedContact, roleId)
          }
          onPressRemoveRole={(roleId: string) =>
            onPressRemoveRole(selectedContact, roleId)
          }
          roles={roles}
          selectedUserRoles={selectedUserRoles}
        />
      )}
      {selectedContact !== null && selectedIsRequest && (
        <GroupJoinRequestSheet
          contact={contacts.find((c) => c.id === selectedContact)}
          contactId={selectedContact}
          currentUserIsAdmin={currentUserIsAdmin}
          open={true}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedContact(null);
            }
          }}
          onPressAccept={() => onPressAcceptJoinRequest(selectedContact)}
          onPressReject={() => onPressRejectJoinRequest(selectedContact)}
        />
      )}
    </>
  );
}
