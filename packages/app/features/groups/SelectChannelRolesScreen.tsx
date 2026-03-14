import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useGroup } from '@tloncorp/shared';
import { Button, Icon, Pressable, Text } from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, View, YStack } from 'tamagui';

import {
  buildAddRoleParamsFromRoleSelection,
  getRoleSelectionSaveAction,
} from './roleSelectionNavigation';
import {
  areAllIdsSelected,
  ensureSelectedId,
  getSelectableRoleOptions,
  toggleAllSelectedIds,
  toggleSelectedIds,
} from './roleSelectionUtils';
import { GroupSettingsStackParamList } from '../../navigation/types';
import { TextInput } from '../../ui/components/Form';
import { ListItem } from '../../ui/components/ListItem';
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
    createdRoleTitle,
  } = route.params;

  const [selectedRoleIds, setSelectedRoleIds] =
    useState<string[]>(initialRoleIds);

  // Auto-select newly created role when returning from AddRole screen
  useEffect(() => {
    setSelectedRoleIds((prev) => ensureSelectedId(prev, createdRoleId));
  }, [createdRoleId]);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: group } = useGroup({ id: groupId });

  const allRoles = useMemo(
    () =>
      getSelectableRoleOptions(
        group?.roles ?? [],
        createdRoleId,
        createdRoleTitle
      ),
    [group?.roles, createdRoleId, createdRoleTitle]
  );
  const allRoleIds = useMemo(
    () => allRoles.map((role) => role.value),
    [allRoles]
  );

  const filteredRoles = useMemo(() => {
    if (!searchQuery.trim()) {
      return allRoles;
    }
    const query = searchQuery.toLowerCase();
    return allRoles.filter((role) => role.label.toLowerCase().includes(query));
  }, [allRoles, searchQuery]);

  const handleToggleRole = useCallback((roleId: string) => {
    setSelectedRoleIds((prev) => toggleSelectedIds(prev, roleId));
  }, []);

  const allSelected = useMemo(
    () => areAllIdsSelected(allRoleIds, selectedRoleIds),
    [allRoleIds, selectedRoleIds]
  );

  const handleSelectAll = useCallback(() => {
    setSelectedRoleIds((prev) => toggleAllSelectedIds(allRoleIds, prev));
  }, [allRoleIds]);

  const handleSave = useCallback(() => {
    navigation.dispatch(
      getRoleSelectionSaveAction(route.params, selectedRoleIds)
    );
  }, [navigation, selectedRoleIds, route.params]);

  const handleCreateRole = useCallback(() => {
    navigation.navigate(
      'AddRole',
      buildAddRoleParamsFromRoleSelection(route.params, selectedRoleIds)
    );
  }, [navigation, selectedRoleIds, route.params]);

  if (!group) {
    return null;
  }

  return (
    <View backgroundColor="$background" flex={1}>
      <ScreenHeader
        title="Select roles"
        backAction={() => navigation.goBack()}
        rightControls={
          <>
            {!searchQuery.trim() && (
              <ScreenHeader.TextButton
                onPress={handleSelectAll}
                color="$positiveActionText"
                testID="SelectAllRoles"
              >
                {allSelected ? 'Deselect all' : 'Select all'}
              </ScreenHeader.TextButton>
            )}
            <ScreenHeader.TextButton
              onPress={handleSave}
              color="$positiveActionText"
              testID="RoleSelectionSaveButton"
            >
              Save
            </ScreenHeader.TextButton>
          </>
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
          <Button
            preset="secondaryOutline"
            onPress={handleCreateRole}
            label="Create new role"
          />
        </YStack>
      </YStack>
    </View>
  );
}
