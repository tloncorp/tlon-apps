import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useGroup } from '@tloncorp/shared';
import { Button, Icon, Pressable, Text } from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, View, YStack } from 'tamagui';

import { GroupSettingsStackParamList } from '../../navigation/types';
import { TextInput } from '../../ui/components/Form';
import { ListItem } from '../../ui/components/ListItem';
import {
  MEMBER_ROLE_OPTION,
  groupRolesToOptions,
} from '../../ui/components/ManageChannels/channelFormUtils';
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
    createdRoleId,
  } = route.params;

  const [selectedRoleIds, setSelectedRoleIds] =
    useState<string[]>(initialRoleIds);

  // Auto-select newly created role when returning from AddRole screen
  useEffect(() => {
    if (createdRoleId && !selectedRoleIds.includes(createdRoleId)) {
      setSelectedRoleIds((prev) => [...prev, createdRoleId]);
    }
  }, [createdRoleId, selectedRoleIds]);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: group } = useGroup({ id: groupId });

  const allRoles = useMemo(
    () => [
      ...groupRolesToOptions(group?.roles ?? []).filter(
        (role) => role.value !== 'admin'
      ),
      MEMBER_ROLE_OPTION,
    ],
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

    // Navigate back to the return screen with selected roles.
    // Access returnScreen/returnParams via route.params so TypeScript
    // can narrow the discriminated union per branch.
    const params = route.params;
    switch (params.returnScreen) {
      case 'CreateChannelPermissions':
        navigation.navigate(params.returnScreen, {
          ...params.returnParams,
          selectedRoleIds: finalRoleIds,
        });
        break;
      case 'EditChannelPrivacy':
        navigation.navigate(params.returnScreen, {
          ...params.returnParams,
          selectedRoleIds: finalRoleIds,
        });
        break;
    }
  }, [navigation, selectedRoleIds, route.params]);

  const handleCreateRole = useCallback(() => {
    navigation.navigate('AddRole', {
      groupId,
      returnScreen: 'SelectChannelRoles',
      returnParams: {
        groupId,
        selectedRoleIds,
        returnScreen: route.params.returnScreen,
        returnParams: route.params.returnParams,
      },
    });
  }, [navigation, groupId, selectedRoleIds, route.params]);

  if (!group) {
    return null;
  }

  return (
    <View backgroundColor="$background" flex={1}>
      <ScreenHeader
        title="Select roles"
        backAction={() => navigation.goBack()}
        rightControls={
          <ScreenHeader.TextButton
            onPress={handleSave}
            color="$positiveActionText"
            testID="RoleSelectionSaveButton"
          >
            Save
          </ScreenHeader.TextButton>
        }
      />
      <YStack flex={1} padding="$xl" gap="$xl">
        <TextInput
          icon="Search"
          placeholder="Search roles"
          value={searchQuery}
          onChangeText={setSearchQuery}
          testID="RoleSearchInput"
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
                  borderRadius="$xl"
                  testID={`RoleOption-${role.label}`}
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
          <Button onPress={handleCreateRole} label="Create new role" />
        </YStack>
      </YStack>
    </View>
  );
}
