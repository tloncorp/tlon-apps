import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/db';
import { Icon, SectionListHeader } from '@tloncorp/ui';
import Fuse from 'fuse.js';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SectionList, SectionListRenderItemInfo } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTokenValue, View } from 'tamagui';

import { useGroupContext } from '../../hooks/useGroupContext';
import { GroupSettingsStackParamList } from '../../navigation/types';
import { ContactList, ScreenHeader, TextInput } from '../../ui';

type Props = NativeStackScreenProps<
  GroupSettingsStackParamList,
  'SelectRoleMembers'
>;

export function SelectRoleMembersScreen({ navigation, route }: Props) {
  const { groupId, selectedMembers: initialSelected, onSave } = route.params;
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>(
    initialSelected
  );
  const { bottom } = useSafeAreaInsets();

  const { groupMembers, groupRoles } = useGroupContext({ groupId });

  const handlePressClear = useCallback(() => {
    setSearchQuery('');
  }, []);

  const fuse = useMemo(() => {
    return new Fuse(groupMembers, {
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
    });
  }, [groupMembers]);

  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) {
      return groupMembers;
    }
    return fuse.search(searchQuery).map((result) => result.item);
  }, [groupMembers, searchQuery, fuse]);

  const membersByRole = useMemo(
    () =>
      filteredMembers.reduce<Record<string, db.ChatMember[]>>((acc, m) => {
        if (m.roles !== undefined && m.roles !== null && m.roles.length > 0) {
          m.roles.forEach((role) => {
            if (acc[role.roleId] === undefined) {
              acc[role.roleId] = [];
            }
            acc[role.roleId].push(m);
          });
        }
        return acc;
      }, {}),
    [filteredMembers]
  );

  const membersWithoutRoles = filteredMembers.filter(
    (m) => m.status !== 'invited' && (m.roles?.length === 0 || m.roles === null)
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
                  title: 'Members',
                  data: membersWithoutRoles,
                },
              ]
            : []
        ),
    [membersByRole, membersWithoutRoles]
  );

  const handleToggleMember = useCallback(
    (member: db.ChatMember) => {
      const contactId = member.contactId;
      if (selectedMembers.includes(contactId)) {
        setSelectedMembers(selectedMembers.filter((id) => id !== contactId));
      } else {
        setSelectedMembers([...selectedMembers, contactId]);
      }
    },
    [selectedMembers]
  );

  const handleSave = useCallback(() => {
    onSave(selectedMembers);
    navigation.goBack();
  }, [selectedMembers, onSave, navigation]);

  const renderItem = useCallback(
    ({ item }: SectionListRenderItemInfo<db.ChatMember, { title: string }>) => {
      const isSelected = selectedMembers.includes(item.contactId);
      return (
        <ContactList.Item
          contactId={item.contactId}
          showNickname
          size="$4xl"
          onPress={() => handleToggleMember(item)}
          showEndContent
          endContent={
            isSelected ? (
              <Icon type="Checkmark" size="$l" color="$positiveActionText" />
            ) : (
              <View
                borderWidth={1}
                borderRadius="$3xl"
                borderColor="$tertiaryText"
                opacity={0.6}
                height="$3xl"
                width="$3xl"
              />
            )
          }
        />
      );
    },
    [selectedMembers, handleToggleMember]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: { title: string } }) => (
      <SectionListHeader>
        <SectionListHeader.Text>
          {groupRoles.find((r) => r.id === section.title)?.title ??
            section.title}
        </SectionListHeader.Text>
      </SectionListHeader>
    ),
    [groupRoles]
  );

  const keyExtractor = useCallback((item: db.ChatMember) => item.contactId, []);

  return (
    <View flex={1} backgroundColor="$background">
      <ScreenHeader title="Select members" rightControls={
        <ScreenHeader.TextButton onPress={handleSave}>Save</ScreenHeader.TextButton>
      } />
      <View paddingHorizontal="$l" paddingBottom="$s">
        <TextInput
          icon="Search"
          placeholder="Search by name or ID"
          value={searchQuery}
          onChangeText={setSearchQuery}
          spellCheck={false}
          autoCorrect={false}
          autoCapitalize="none"
          rightControls={
            searchQuery !== '' ? (
              <TextInput.InnerButton
                label="Clear"
                onPress={handlePressClear}
              />
            ) : undefined
          }
        />
      </View>
      <SectionList
        sections={sectionedData}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{
          paddingHorizontal: getTokenValue('$l', 'size'),
          paddingBottom: bottom,
        }}
      />
    </View>
  );
}
