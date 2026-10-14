import * as db from '@tloncorp/shared/db';
import Fuse from 'fuse.js';
import { useMemo, useState } from 'react';

import { useCalm } from '../contexts/appDataContext';
import { useIsAdmin } from '../utils';
import { GroupJoinRequestSheet } from './GroupJoinRequestSheet';
import { GroupMemberProfileSheet } from './GroupMemberProfileSheet';
import {
  SETTINGS_LIST_COLUMN_WIDTH,
  type SettingsSectionModel,
  SettingsListScreenView,
  contactSettingsRow,
} from './SettingsList';

type GroupPrivacy = db.schema.GroupPrivacy;
type Person = Pick<db.ChatMember, 'contactId' | 'contact'>;

/**
 * The native lists draw every row they are given, so a large group is shown a
 * page at a time. Searching is the quick way to one person.
 */
const pageSize = 100;

export function GroupMembersScreenView({
  goBack,
  members,
  roles,
  groupId,
  bannedUsers,
  joinRequests,
  currentUserId,
  onPressAcceptJoinRequest,
  onPressRejectJoinRequest,
  onPressGoToProfile,
}: {
  goBack: () => void;
  members: db.ChatMember[];
  roles: db.GroupRole[];
  currentUserId: string;
  groupId: string;
  bannedUsers: db.GroupMemberBan[];
  joinRequests: db.GroupJoinRequest[];
  groupPrivacyType: GroupPrivacy;
  onPressAcceptJoinRequest: (contactId: string) => void;
  onPressRejectJoinRequest: (contactId: string) => void;
  onPressGoToProfile: (contactId: string) => void;
}) {
  const { disableNicknames } = useCalm();
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [limit, setLimit] = useState(pageSize);
  const currentUserIsAdmin = useIsAdmin(groupId, currentUserId);

  const groups = useMemo(() => {
    const contacts = new Map(
      members.flatMap((m) => (m.contact ? [[m.contactId, m.contact]] : []))
    );
    const outsiders = (list: { contactId: string }[]): Person[] =>
      list.map(({ contactId }) => ({
        contactId,
        contact: contacts.get(contactId),
      }));
    const query = searchQuery.trim();
    const matching = <T extends Person>(people: T[]) =>
      query
        ? new Fuse(people, {
            keys: [
              {
                name: 'contact.nickname',
                getFn: (person) => person.contact?.nickname || '',
              },
              {
                name: 'contact.id',
                getFn: (person) => person.contact?.id || person.contactId,
              },
            ],
            threshold: 0.4,
          })
            .search(query)
            .map((result) => result.item)
        : people;

    const found = matching(members);
    const byRole = new Map<string, db.ChatMember[]>();
    for (const member of found) {
      for (const role of member.roles ?? []) {
        byRole.set(role.roleId, [...(byRole.get(role.roleId) ?? []), member]);
      }
    }

    const all: { key: string; title: string; people: Person[] }[] = [
      ...[...byRole].map(([roleId, people]) => ({
        key: `role-${roleId}`,
        title: roles.find((role) => role.id === roleId)?.title ?? roleId,
        people,
      })),
      {
        key: 'join-requests',
        title: 'Join Requests',
        people: currentUserIsAdmin ? matching(outsiders(joinRequests)) : [],
      },
      {
        key: 'invited',
        title: 'Invited',
        people: found.filter((m) => m.status === 'invited'),
      },
      {
        key: 'banned',
        title: 'Banned Users',
        people: currentUserIsAdmin ? matching(outsiders(bannedUsers)) : [],
      },
      {
        key: 'members',
        title: 'Members',
        people: found.filter((m) => m.status !== 'invited' && !m.roles?.length),
      },
    ];
    return all.filter((group) => group.people.length > 0);
  }, [
    bannedUsers,
    currentUserIsAdmin,
    joinRequests,
    members,
    roles,
    searchQuery,
  ]);

  const sections = useMemo(() => {
    let room = limit;
    let hidden = 0;
    const shown: SettingsSectionModel[] = [];
    for (const group of groups) {
      const people = group.people.slice(0, room);
      room -= people.length;
      hidden += group.people.length - people.length;
      if (people.length === 0) {
        continue;
      }
      shown.push({
        key: group.key,
        title: group.title,
        rows: people.map(({ contactId, contact }) => ({
          ...contactSettingsRow(contactId, contact, disableNicknames),
          accessory: 'none',
          onPress: () => setSelectedContact(contactId),
          contextActions: [
            {
              key: 'profile',
              title: 'View profile',
              systemImage: 'person.crop.circle',
              onPress: () => onPressGoToProfile(contactId),
            },
          ],
          testID: 'MemberRow',
        })),
      });
    }
    if (shown.length === 0 && searchQuery.trim()) {
      return [
        {
          key: 'none',
          rows: [{ key: 'none', title: 'No one matches that search.' }],
        },
      ];
    }
    if (hidden > 0) {
      shown.push({
        key: 'more',
        rows: [
          {
            key: 'more',
            title: `Show ${Math.min(hidden, pageSize)} more`,
            action: true,
            onPress: () => setLimit((current) => current + pageSize),
            testID: 'ShowMoreMembers',
          },
        ],
      });
    }
    return shown;
  }, [disableNicknames, groups, limit, onPressGoToProfile, searchQuery]);

  const selectedIsRequest = joinRequests.some(
    (request) => request.contactId === selectedContact
  );

  return (
    <SettingsListScreenView
      title="Members"
      sections={sections}
      onBackPressed={goBack}
      showsBackOnWideWindows
      maxWidth={SETTINGS_LIST_COLUMN_WIDTH}
      // A heading per role leaves many short cards; default gaps outweigh them.
      compactSections
      search={{
        value: searchQuery,
        onChangeText: setSearchQuery,
        placeholder: 'Search by name or ID',
      }}
    >
      {selectedContact !== null && !selectedIsRequest && (
        <GroupMemberProfileSheet
          selectedContact={selectedContact}
          onDismiss={() => setSelectedContact(null)}
          groupId={groupId}
          onPressGoToProfile={onPressGoToProfile}
        />
      )}
      {selectedContact !== null && selectedIsRequest && (
        <GroupJoinRequestSheet
          contact={
            members.find((m) => m.contactId === selectedContact)?.contact ??
            undefined
          }
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
          onPressGoToProfile={() => {
            setSelectedContact(null);
            onPressGoToProfile(selectedContact);
          }}
        />
      )}
    </SettingsListScreenView>
  );
}
