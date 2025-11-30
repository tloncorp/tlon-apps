import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/db';
import { Icon } from '@tloncorp/ui';
import Fuse from 'fuse.js';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, ListRenderItemInfo } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, getTokenValue } from 'tamagui';

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
  const [selectedMembers, setSelectedMembers] =
    useState<string[]>(initialSelected);
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
    const members = searchQuery.trim()
      ? fuse.search(searchQuery).map((result) => result.item)
      : groupMembers;

    // Filter out invited members and sort alphabetically by nickname or id
    return members
      .filter((m) => m.status !== 'invited')
      .sort((a, b) => {
        const aName = a.contact?.nickname || a.contactId;
        const bName = b.contact?.nickname || b.contactId;
        return aName.localeCompare(bName);
      });
  }, [groupMembers, searchQuery, fuse]);

  const getRoleLabels = useCallback(
    (member: db.ChatMember) => {
      if (!member.roles || member.roles.length === 0) {
        return 'No roles';
      }
      return member.roles
        .map((role) => {
          const foundRole = groupRoles.find((r) => r.id === role.roleId);
          return foundRole?.title || role.roleId;
        })
        .join(', ');
    },
    [groupRoles]
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

  const handleGoBack = useCallback(() => {
    onSave(selectedMembers);
    navigation.goBack();
  }, [selectedMembers, onSave, navigation]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<db.ChatMember>) => {
      const isSelected = selectedMembers.includes(item.contactId);
      const roleLabels = getRoleLabels(item);

      return (
        <ContactList.Item
          contactId={item.contactId}
          showNickname
          size="$4xl"
          onPress={() => handleToggleMember(item)}
          showEndContent
          subtitle={roleLabels}
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
    [selectedMembers, handleToggleMember, getRoleLabels]
  );

  const keyExtractor = useCallback((item: db.ChatMember) => item.contactId, []);

  return (
    <View flex={1} backgroundColor="$background">
      <ScreenHeader backAction={handleGoBack} title="Select members" />
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
              <TextInput.InnerButton label="Clear" onPress={handlePressClear} />
            ) : undefined
          }
        />
      </View>
      <FlatList
        data={filteredMembers}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={{
          paddingHorizontal: getTokenValue('$l', 'size'),
          paddingBottom: bottom,
        }}
      />
    </View>
  );
}
