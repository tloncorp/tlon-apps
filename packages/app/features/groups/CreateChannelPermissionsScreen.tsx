import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { createChannel, useGroup } from '@tloncorp/shared';
import { Button } from '@tloncorp/ui';
import { useCallback, useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, View, YStack } from 'tamagui';

import { GroupSettingsStackParamList } from '../../navigation/types';
import { PermissionTable } from '../../ui/components/ManageChannels/ChannelPermissions';
import {
  PermissionActionButtons,
  processFinalPermissions,
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

  const form = useForm({
    defaultValues: {
      title: channelTitle,
      description: '',
      isPrivate: true,
      readers: selectedRoleIds ?? ['admin'],
      writers: ['admin'],
    },
  });

  // Handle newly created role returned from AddRole screen
  useEffect(() => {
    if (!createdRoleId) return;
    const currentReaders = form.getValues('readers');
    if (!currentReaders.includes(createdRoleId)) {
      const base = currentReaders.includes('admin')
        ? currentReaders
        : ['admin', ...currentReaders];
      form.setValue('readers', [...base, createdRoleId]);
    }
  }, [createdRoleId, form]);

  // Handle roles selected from SelectChannelRoles screen
  useEffect(() => {
    if (!selectedRoleIds) return;
    form.setValue('readers', selectedRoleIds);
  }, [selectedRoleIds, form]);

  const handleSelectRoles = useCallback(() => {
    const currentReaders = form.getValues('readers');
    navigation.navigate('SelectChannelRoles', {
      groupId,
      selectedRoleIds: currentReaders,
      returnScreen: 'CreateChannelPermissions',
      returnParams: {
        groupId,
        channelTitle,
        channelType,
      },
    });
  }, [navigation, groupId, form, channelTitle, channelType]);

  const handleCreateChannel = useCallback(() => {
    const {
      readers: currentReaders,
      writers: currentWriters,
      isPrivate: currentIsPrivate,
    } = form.getValues();
    const { finalReaders, finalWriters } = processFinalPermissions(
      currentReaders,
      currentWriters,
      currentIsPrivate
    );

    createChannel({
      groupId,
      title: channelTitle,
      channelType,
      readers: finalReaders,
      writers: finalWriters,
    });

    // Navigate back to channel list
    navigation.navigate('ManageChannels', { groupId }, { pop: true });
  }, [navigation, groupId, form, channelTitle, channelType]);

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
            <PermissionActionButtons onSelectRoles={handleSelectRoles} />
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
