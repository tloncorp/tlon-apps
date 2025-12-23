import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/db';
import { useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useHandleGoBack } from '../../hooks/useChatSettingsNavigation';
import { useGroupContext } from '../../hooks/useGroupContext';
import { GroupSettingsStackParamList } from '../../navigation/types';
import {
  ActionSheet,
  ListItem,
  Pressable,
  ScreenHeader,
  ScrollView,
  View,
  YStack,
  useIsWindowNarrow,
} from '../../ui';
import { Badge } from '../../ui/components/Badge';

type Props = NativeStackScreenProps<GroupSettingsStackParamList, 'GroupRoles'>;

export function GroupRolesScreen(props: Props) {
  return (
    <GroupRolesScreenView navigation={props.navigation} route={props.route} />
  );
}

type GroupRolesScreenViewProps = {
  navigation: Props['navigation'];
  route: Props['route'];
};

function GroupRolesScreenView({
  navigation,
  route,
}: GroupRolesScreenViewProps) {
  const { groupId, fromChatDetails } = route.params;

  const insets = useSafeAreaInsets();

  const { groupRoles, groupMembers } = useGroupContext({
    groupId,
  });

  const handleGoBack = useHandleGoBack(navigation, {
    groupId,
    fromChatDetails,
  });

  const getMemberCountForRole = useCallback(
    (roleId: string) => {
      return groupMembers.filter((member) =>
        member.roles?.some((r) => r.roleId === roleId)
      ).length;
    },
    [groupMembers]
  );

  const handleSetEditRole = useCallback(
    (role: db.GroupRole) => {
      navigation.navigate('EditRole', {
        groupId,
        roleId: role.id!,
        fromChatDetails,
      });
    },
    [navigation, groupId, fromChatDetails]
  );

  const handleAddRole = useCallback(() => {
    navigation.navigate('AddRole', {
      groupId,
      fromChatDetails,
    });
  }, [navigation, groupId, fromChatDetails]);

  const isWindowNarrow = useIsWindowNarrow();

  return (
    <View flex={1} backgroundColor="$secondaryBackground">
      <ScreenHeader
        backAction={handleGoBack}
        title={'Group Roles'}
        backgroundColor="$secondaryBackground"
        useHorizontalTitleLayout={!isWindowNarrow}
        rightControls={
          <ScreenHeader.TextButton
            color={'$positiveActionText'}
            onPress={handleAddRole}
          >
            New
          </ScreenHeader.TextButton>
        }
      />
      <ScrollView
        flex={1}
        contentContainerStyle={{
          padding: '$l',
          paddingTop: '$xl',
          paddingBottom: insets.bottom,
          gap: '$3xl',
          flexDirection: 'column',
        }}
      >
        <ActionSheet.ActionGroup
          padding={0}
          contentProps={{
            backgroundColor: '$background',
            borderRadius: '$2xl',
            borderWidth: 0,
          }}
        >
          {groupRoles.map((role) => (
            <Pressable key={role.id} onPress={() => handleSetEditRole(role)}>
              <ListItem
                paddingHorizontal="$2xl"
                backgroundColor={'$background'}
                borderRadius="$2xl"
                testID={`GroupRole-${role.title}`}
              >
                <ActionSheet.ActionContent>
                  <ActionSheet.ActionTitle>
                    {role.title}
                  </ActionSheet.ActionTitle>
                  {role.description && (
                    <ListItem.Subtitle>{role.description}</ListItem.Subtitle>
                  )}
                </ActionSheet.ActionContent>

                <ListItem.EndContent
                  flexDirection="row"
                  gap="$xl"
                  alignItems="center"
                >
                  {getMemberCountForRole(role.id) > 0 ? (
                    <ListItem.Count
                      notified={false}
                      count={getMemberCountForRole(role.id!)}
                    />
                  ) : (
                    <Badge text="Add" />
                  )}
                  <ActionSheet.ActionIcon
                    type="ChevronRight"
                    color="$tertiaryText"
                  />
                </ListItem.EndContent>
              </ListItem>
            </Pressable>
          ))}
        </ActionSheet.ActionGroup>
      </ScrollView>
    </View>
  );
}
