import { useNavigation, useRoute } from '@react-navigation/native';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { createChannel, useGroup } from '@tloncorp/shared';
import { Button } from '@tloncorp/ui';
import { useCallback, useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, View, YStack } from 'tamagui';

import { GroupSettingsStackParamList } from '../../navigation/types';
import {
  MEMBERS_MARKER,
  PermissionTable,
} from '../../ui/components/ManageChannels/EditChannelScreenView';
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

  const [readers, setReaders] = useState<string[]>(
    selectedRoleIds || (createdRoleId ? ['admin', createdRoleId] : ['admin'])
  );
  const [writers, setWriters] = useState<string[]>(['admin']);

  const { data: group } = useGroup({ id: groupId });

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

  const { setValue } = form;

  // Sync form state with local state
  useEffect(() => {
    setValue('readers', readers);
  }, [readers, setValue]);

  useEffect(() => {
    setValue('writers', writers);
  }, [writers, setValue]);

  useEffect(() => {
    if (createdRoleId && !readers.includes(createdRoleId)) {
      setReaders((prev) => [...prev, createdRoleId]);
    }
  }, [createdRoleId, readers]);

  useEffect(() => {
    if (selectedRoleIds) {
      setReaders(selectedRoleIds);
    }
  }, [selectedRoleIds]);

  const handleRemoveRole = useCallback((roleId: string) => {
    if (roleId === 'admin') return;
    setReaders((prev) => prev.filter((r) => r !== roleId));
    // If removing Members, also remove from writers
    if (roleId === MEMBERS_MARKER) {
      setWriters((prev) => prev.filter((w) => w !== roleId));
    }
  }, []);

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
    // If MEMBERS_MARKER is present, send empty array (everyone including admin has access)
    // Otherwise, send the role IDs (admin should already be included in the arrays)
    const finalReaders = readers.includes(MEMBERS_MARKER)
      ? []
      : readers.filter((r) => r !== MEMBERS_MARKER);

    const finalWriters = writers.includes(MEMBERS_MARKER)
      ? []
      : writers.filter((w) => w !== MEMBERS_MARKER);

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
            <PermissionTable
              groupRoles={group.roles ?? []}
              onSelectRoles={handleSelectRoles}
              onCreateRole={handleCreateRole}
              onRemoveRole={handleRemoveRole}
            />
            <Button onPress={handleCreateChannel} hero>
              <Button.Text>Create channel</Button.Text>
            </Button>
          </YStack>
        </ScrollView>
      </View>
    </FormProvider>
  );
}
