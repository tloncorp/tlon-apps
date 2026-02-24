import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { createChannel, useGroup } from '@tloncorp/shared';
import { Button } from '@tloncorp/ui';
import { useCallback } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, View, YStack } from 'tamagui';

import { GroupSettingsStackParamList } from '../../navigation/types';
import { PermissionTable } from '../../ui/components/ManageChannels/ChannelPermissions';
import {
  PermissionActionButtons,
  processFinalPermissions,
  useChannelPermissionState,
  usePermissionFormSync,
} from '../../ui/components/ManageChannels/ChannelPermissionsContent';
import { ScreenHeader } from '../../ui/components/ScreenHeader';

export function CreateChannelPermissionsScreen() {
  const navigation =
    useNavigation<
      NativeStackNavigationProp<
        GroupSettingsStackParamList,
        'CreateChannelPermissions'
      >
    >();
  const route =
    useRoute<
      RouteProp<GroupSettingsStackParamList, 'CreateChannelPermissions'>
    >();
  const insets = useSafeAreaInsets();

  const { groupId, channelTitle, channelType, createdRoleId, selectedRoleIds } =
    route.params;

  const { data: group } = useGroup({ id: groupId });

  const { readers, writers } = useChannelPermissionState({
    initialReaders: ['admin'],
    initialWriters: ['admin'],
    createdRoleId,
    selectedRoleIds,
  });

  // Create form for PermissionTable
  const form = useForm({
    defaultValues: {
      title: channelTitle,
      description: '',
      isPrivate: true,
      readers,
      writers,
    },
  });

  usePermissionFormSync(form.setValue, readers, writers);

  const handleSelectRoles = useCallback(() => {
    navigation.navigate('SelectChannelRoles', {
      groupId,
      selectedRoleIds: readers,
      returnScreen: 'CreateChannelPermissions',
      returnParams: {
        groupId,
        channelTitle,
        channelType,
      },
    });
  }, [navigation, groupId, readers, channelTitle, channelType]);

  const handleCreateRole = useCallback(() => {
    navigation.navigate('AddRole', {
      groupId,
      returnScreen: 'CreateChannelPermissions',
      returnParams: {
        groupId,
        channelTitle,
        channelType,
      },
    });
  }, [navigation, groupId, channelTitle, channelType]);

  const handleCreateChannel = useCallback(() => {
    const { finalReaders, finalWriters } = processFinalPermissions(
      readers,
      writers
    );

    createChannel({
      groupId,
      title: channelTitle,
      channelType,
      readers: finalReaders,
      writers: finalWriters,
    });

    // Navigate back to channel list
    navigation.navigate('ManageChannels', { groupId });
  }, [navigation, groupId, channelTitle, channelType, readers, writers]);

  if (!group) {
    return null;
  }

  return (
    <FormProvider {...form}>
      <View backgroundColor="$background" flex={1}>
        <ScreenHeader
          title="Channel permissions"
          backAction={() => navigation.goBack()}
        />
        <ScrollView
          flex={1}
          contentContainerStyle={{ paddingBottom: insets.bottom }}
        >
          <YStack gap="$2xl" padding="$xl">
            <PermissionTable groupRoles={group.roles ?? []} />
            <PermissionActionButtons
              onSelectRoles={handleSelectRoles}
              onCreateRole={handleCreateRole}
            />
            <Button
              preset="primary"
              onPress={handleCreateChannel}
              label="Create channel"
            />
          </YStack>
        </ScrollView>
      </View>
    </FormProvider>
  );
}
