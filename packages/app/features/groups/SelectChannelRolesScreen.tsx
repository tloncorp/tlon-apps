import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useGroup } from '@tloncorp/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { GroupSettingsStackParamList } from '../../navigation/types';
import {
  MEMBER_ROLE_OPTION,
  groupRolesToOptions,
} from '../../ui/components/ManageChannels/channelFormUtils';
import {
  SETTINGS_LIST_COLUMN_WIDTH,
  type SettingsSectionModel,
  SettingsListScreenView,
} from '../../ui/components/SettingsList';

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
        navigation.navigate(
          params.returnScreen,
          {
            ...params.returnParams,
            selectedRoleIds: finalRoleIds,
          },
          { pop: true }
        );
        break;
      case 'EditChannelPrivacy':
        navigation.navigate(
          params.returnScreen,
          {
            ...params.returnParams,
            selectedRoleIds: finalRoleIds,
          },
          { pop: true }
        );
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

  const sections = useMemo<SettingsSectionModel[]>(
    () => [
      {
        key: 'roles',
        rows:
          filteredRoles.length > 0
            ? filteredRoles.map((role) => ({
                key: role.value,
                title: role.label,
                selected: selectedRoleIds.includes(role.value),
                multiple: true,
                onPress: () => handleToggleRole(role.value),
                testID: `RoleOption-${role.label}`,
              }))
            : [{ key: 'empty', title: 'No roles found' }],
      },
      {
        key: 'create',
        rows: [
          {
            key: 'create',
            title: 'Create new role',
            action: true,
            onPress: handleCreateRole,
          },
        ],
      },
    ],
    [filteredRoles, handleCreateRole, handleToggleRole, selectedRoleIds]
  );

  return (
    <SettingsListScreenView
      title="Select roles"
      sections={sections}
      loading={!group}
      onBackPressed={() => navigation.goBack()}
      showsBackOnWideWindows
      maxWidth={SETTINGS_LIST_COLUMN_WIDTH}
      search={{
        value: searchQuery,
        onChangeText: setSearchQuery,
        placeholder: 'Search roles',
        testID: 'RoleSearchInput',
      }}
      rightActions={[
        {
          id: 'RoleSelectionSaveButton',
          text: 'Save',
          tint: '$positiveActionText',
          onPress: handleSave,
          testID: 'RoleSelectionSaveButton',
        },
      ]}
    />
  );
}
