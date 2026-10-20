import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo } from 'react';

import { useHandleGoBack } from '../../hooks/useChatSettingsNavigation';
import { useGroupContext } from '../../hooks/useGroupContext';
import { GroupSettingsStackParamList } from '../../navigation/types';
import { useIsWindowNarrow } from '../../ui';
import {
  SETTINGS_LIST_COLUMN_WIDTH,
  type SettingsSectionModel,
  SettingsListScreenView,
} from '../../ui/components/SettingsList';

type Props = NativeStackScreenProps<GroupSettingsStackParamList, 'GroupRoles'>;

export function GroupRolesScreen({ navigation, route }: Props) {
  const { groupId, fromChatDetails } = route.params;
  const { groupRoles, groupMembers } = useGroupContext({ groupId });
  const isWindowNarrow = useIsWindowNarrow();

  const handleGoBack = useHandleGoBack(navigation, {
    groupId,
    fromChatDetails,
  });

  const sections = useMemo<SettingsSectionModel[]>(
    () => [
      {
        key: 'roles',
        rows: [
          ...groupRoles.map((role) => ({
            key: role.id,
            title: role.title ?? '',
            subtitle: role.description ?? undefined,
            value: String(
              groupMembers.filter((member) =>
                member.roles?.some((r) => r.roleId === role.id)
              ).length
            ),
            onPress: () =>
              navigation.navigate('EditRole', {
                groupId,
                roleId: role.id,
                fromChatDetails,
              }),
            testID: `GroupRole-${role.title}`,
          })),
          // Everyone holds this one, so it opens the group's members; that
          // also keeps its count in line with the others above it.
          {
            key: 'members',
            title: 'Members',
            subtitle: 'All workspace members',
            // Counts who has joined, as the info screen does; people only
            // invited so far aren't members yet.
            value: String(
              groupMembers.filter((member) => member.status !== 'invited')
                .length
            ),
            onPress: () =>
              navigation.navigate('GroupMembers', { groupId, fromChatDetails }),
            testID: 'GroupRole-Members',
          },
        ],
      },
    ],
    [fromChatDetails, groupId, groupMembers, groupRoles, navigation]
  );

  return (
    <SettingsListScreenView
      title="Workspace roles"
      sections={sections}
      onBackPressed={handleGoBack}
      showsBackOnWideWindows
      maxWidth={SETTINGS_LIST_COLUMN_WIDTH}
      useHorizontalTitleLayout={!isWindowNarrow}
      rightActions={[
        {
          id: 'GroupRolesNewButton',
          icon: 'Add',
          label: 'New role',
          onPress: () =>
            navigation.navigate('AddRole', { groupId, fromChatDetails }),
        },
      ]}
    />
  );
}
