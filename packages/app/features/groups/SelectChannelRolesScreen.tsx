import { useNavigation, useRoute } from '@react-navigation/native';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useGroup } from '@tloncorp/shared';
import { Button, Icon, Pressable, Text } from '@tloncorp/ui';
import { useCallback, useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, View, YStack } from 'tamagui';

import { GroupSettingsStackParamList } from '../../navigation/types';
import { TextInput } from '../../ui/components/Form';
import { ListItem } from '../../ui/components/ListItem';
import { groupRolesToOptions } from '../../ui/components/ManageChannels/EditChannelScreenView';
import { ScreenHeader } from '../../ui/components/ScreenHeader';

export function SelectChannelRolesScreen() {
  const navigation =
    useNavigation<
      NativeStackNavigationProp<
        GroupSettingsStackParamList,
        'SelectChannelRoles'
      >
    >();
  const route =
    useRoute<RouteProp<GroupSettingsStackParamList, 'SelectChannelRoles'>>();
  const insets = useSafeAreaInsets();

  const {
    groupId,
    selectedRoleIds: initialRoleIds,
    returnScreen,
    returnParams,
  } = route.params;

  const [selectedRoleIds, setSelectedRoleIds] =
    useState<string[]>(initialRoleIds);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: group } = useGroup({ id: groupId });

  const allRoles = useMemo(
    () =>
      groupRolesToOptions(group?.roles ?? []).filter(
        (role) => role.value !== 'admin'
      ),
    [group?.roles]
  );

  const filteredRoles = useMemo(() => {
    if (!searchQuery.trim()) {
      return allRoles;
    }
    const query = searchQuery.toLowerCase();
    return allRoles.filter((role) => role.label.toLowerCase().includes(query));
  }, [allRoles, searchQuery]);

  const handleToggleRole = useCallback((roleId: string) => {
    setSelectedRoleIds((prev) => {
      if (prev.includes(roleId)) {
        return prev.filter((id) => id !== roleId);
      } else {
        return [...prev, roleId];
      }
    });
  }, []);

  const handleSave = useCallback(() => {
    // Ensure admin is always included
    const finalRoleIds = selectedRoleIds.includes('admin')
      ? selectedRoleIds
      : ['admin', ...selectedRoleIds];

    navigation.navigate(returnScreen, {
      ...returnParams,
      selectedRoleIds: finalRoleIds,
    } as any);
  }, [navigation, returnScreen, returnParams, selectedRoleIds]);

  const handleCreateRole = useCallback(() => {
    navigation.navigate('AddRole', {
      groupId,
      returnScreen: 'SelectChannelRoles',
      returnParams: {
        groupId,
        selectedRoleIds,
        returnScreen,
        returnParams,
      },
    });
  }, [navigation, groupId, selectedRoleIds, returnScreen, returnParams]);

  if (!group) {
    return null;
  }

  return (
    <View backgroundColor="$background" flex={1}>
      <ScreenHeader
        title="Select roles"
        backAction={() => navigation.goBack()}
      />
      <YStack flex={1} padding="$xl" gap="$xl">
        <TextInput
          icon="Search"
          placeholder="Search roles"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <ScrollView
          flex={1}
          contentContainerStyle={{ paddingBottom: insets.bottom }}
        >
          <YStack gap="$m">
            {filteredRoles.map((role) => {
              const isSelected = selectedRoleIds.includes(role.value);
              return (
                <Pressable
                  key={role.value}
                  onPress={() => handleToggleRole(role.value)}
                >
                  <ListItem
                    backgroundColor={
                      isSelected ? '$secondaryBackground' : 'transparent'
                    }
                    borderColor="$secondaryBorder"
                    borderWidth={isSelected ? 0 : 1}
                    borderRadius="$xl"
                    paddingHorizontal="$2xl"
                    paddingVertical="$xl"
                  >
                    <ListItem.MainContent>
                      <ListItem.Title>{role.label}</ListItem.Title>
                    </ListItem.MainContent>
                    {isSelected && (
                      <ListItem.EndContent>
                        <Icon type="Checkmark" />
                      </ListItem.EndContent>
                    )}
                  </ListItem>
                </Pressable>
              );
            })}
            {filteredRoles.length === 0 && (
              <View paddingVertical="$2xl" alignItems="center">
                <Text color="$tertiaryText">No roles found</Text>
              </View>
            )}
          </YStack>
        </ScrollView>
        <YStack gap="$m" paddingBottom={insets.bottom}>
          <Button onPress={handleCreateRole} secondary>
            <Button.Text>Create new role</Button.Text>
          </Button>
          <Button onPress={handleSave} hero>
            <Button.Text>Save</Button.Text>
          </Button>
        </YStack>
      </YStack>
    </View>
  );
}
