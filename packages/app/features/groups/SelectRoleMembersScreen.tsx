import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type * as db from '@tloncorp/shared/db';
import { useIsWindowNarrow } from '@tloncorp/ui';
import Fuse from 'fuse.js';
import { useCallback, useMemo, useState } from 'react';

import { useGroupContext } from '../../hooks/useGroupContext';
import { GroupSettingsStackParamList } from '../../navigation/types';
import { useCalm } from '../../ui';
import {
  SETTINGS_LIST_COLUMN_WIDTH,
  type SettingsSectionModel,
  SettingsListScreenView,
  contactSettingsRow,
} from '../../ui/components/SettingsList';

type Props = NativeStackScreenProps<
  GroupSettingsStackParamList,
  'SelectRoleMembers'
>;

/**
 * The native lists draw every row they are given, so a large group is shown a
 * page at a time. Searching is the quick way to one person.
 */
const pageSize = 100;

export function SelectRoleMembersScreen({ navigation, route }: Props) {
  const {
    groupId,
    roleId,
    selectedMembers: initialSelected,
    onSave,
  } = route.params;
  const isWindowNarrow = useIsWindowNarrow();
  const { disableNicknames } = useCalm();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMembers, setSelectedMembers] =
    useState<string[]>(initialSelected);
  const [limit, setLimit] = useState(pageSize);
  // any member can be picked, so load the whole roster
  const { groupMembers, groupRoles } = useGroupContext({
    groupId,
    wholeRoster: true,
  });

  const role = useMemo(
    () => groupRoles.find((r) => r.id === roleId),
    [groupRoles, roleId]
  );

  const filteredMembers = useMemo(() => {
    const query = searchQuery.trim();
    const members = query
      ? new Fuse(groupMembers, {
          keys: [
            {
              name: 'contact.nickname',
              getFn: (member) => member.contact?.nickname || '',
            },
            {
              name: 'contact.id',
              getFn: (member) => member.contact?.id || member.contactId,
            },
          ],
          threshold: 0.4,
        })
          .search(query)
          .map((result) => result.item)
      : groupMembers;
    // Invited members can't hold roles yet; the rest go in name order.
    return members
      .filter((m) => m.status !== 'invited')
      .sort((a, b) => {
        const aName = a.contact?.nickname || a.contactId;
        const bName = b.contact?.nickname || b.contactId;
        return aName.localeCompare(bName);
      });
  }, [groupMembers, searchQuery]);

  const roleLabels = useCallback(
    (member: db.ChatMember) =>
      member.roles?.length
        ? member.roles
            .map(
              ({ roleId: id }) =>
                groupRoles.find((r) => r.id === id)?.title || id
            )
            .join(', ')
        : 'No roles',
    [groupRoles]
  );

  // Picks go straight back to the role form, which saves them with the rest
  // of the role, so there's nothing to confirm here.
  const toggleMember = useCallback(
    (contactId: string) => {
      const next = selectedMembers.includes(contactId)
        ? selectedMembers.filter((id) => id !== contactId)
        : [...selectedMembers, contactId];
      setSelectedMembers(next);
      onSave(next);
    },
    [selectedMembers, onSave]
  );

  const sections = useMemo((): SettingsSectionModel[] => {
    if (filteredMembers.length === 0) {
      return searchQuery.trim()
        ? [
            {
              key: 'none',
              rows: [{ key: 'none', title: 'No one matches that search.' }],
            },
          ]
        : [];
    }
    const shown = filteredMembers.slice(0, limit);
    const hidden = filteredMembers.length - shown.length;
    return [
      {
        key: 'members',
        rows: shown.map((member) => ({
          ...contactSettingsRow(
            member.contactId,
            member.contact,
            disableNicknames
          ),
          // The roles someone holds now, in place of their ID.
          subtitle: roleLabels(member),
          selected: selectedMembers.includes(member.contactId),
          multiple: true,
          onPress: () => toggleMember(member.contactId),
          testID: `RoleMember-${member.contactId}`,
        })),
      },
      ...(hidden > 0
        ? [
            {
              key: 'more',
              rows: [
                {
                  key: 'more',
                  title: `Show ${Math.min(hidden, pageSize)} more`,
                  action: true,
                  onPress: () => setLimit((current) => current + pageSize),
                },
              ],
            },
          ]
        : []),
    ];
  }, [
    disableNicknames,
    filteredMembers,
    limit,
    roleLabels,
    searchQuery,
    selectedMembers,
    toggleMember,
  ]);

  return (
    <SettingsListScreenView
      title={role ? `Members of ${role.title}` : 'Select members'}
      sections={sections}
      onBackPressed={() => navigation.goBack()}
      showsBackOnWideWindows
      useHorizontalTitleLayout={!isWindowNarrow}
      maxWidth={SETTINGS_LIST_COLUMN_WIDTH}
      search={{
        value: searchQuery,
        onChangeText: setSearchQuery,
        placeholder: 'Search by name or ID',
      }}
    />
  );
}
