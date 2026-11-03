import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { createChannel, useGroup } from '@tloncorp/shared';
import { useIsWindowNarrow, useToast } from '@tloncorp/ui';
import { useCallback, useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { GroupSettingsStackParamList } from '../../navigation/types';
import {
  type ChannelAccess,
  channelAccessSections,
  withCreatedRole,
} from '../../ui/components/ManageChannels/channelAccessSections';
import { processFinalPermissions } from '../../ui/components/ManageChannels/channelFormUtils';
import {
  SETTINGS_LIST_COLUMN_WIDTH,
  SettingsListScreenView,
} from '../../ui/components/SettingsList';

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
  const isWindowNarrow = useIsWindowNarrow();
  const toast = useToast();
  const [isCreating, setIsCreating] = useState(false);

  const { groupId, channelTitle, channelType, createdRoleId } = route.params;

  const { data: group } = useGroup({ id: groupId });

  const form = useForm({
    defaultValues: {
      title: channelTitle,
      description: '',
      isPrivate: true,
      readers: ['admin'],
      writers: ['admin'],
    },
  });

  const isPrivate = useWatch({ control: form.control, name: 'isPrivate' });
  const readers = useWatch({ control: form.control, name: 'readers' });
  const writers = useWatch({ control: form.control, name: 'writers' });

  const handleAccessChange = useCallback(
    (access: ChannelAccess) => {
      form.setValue('isPrivate', access.isPrivate, { shouldDirty: true });
      form.setValue('readers', access.readers, { shouldDirty: true });
      form.setValue('writers', access.writers, { shouldDirty: true });
    },
    [form]
  );

  // A role made from here comes back with access of its own.
  useEffect(() => {
    if (!createdRoleId) return;
    const current = form.getValues();
    const next = withCreatedRole(current, createdRoleId, channelType);
    if (next !== current) {
      handleAccessChange(next);
    }
  }, [channelType, createdRoleId, form, handleAccessChange]);

  const handleCreateRole = useCallback(() => {
    navigation.navigate('AddRole', {
      groupId,
      returnScreen: 'CreateChannelPermissions',
      returnParams: { groupId, channelTitle, channelType },
    });
  }, [navigation, groupId, channelTitle, channelType]);

  const handleCreateChannel = useCallback(async () => {
    const {
      readers: currentReaders,
      writers: currentWriters,
      isPrivate: currentIsPrivate,
    } = form.getValues();
    const { finalReaders, finalWriters } = processFinalPermissions(
      currentReaders,
      currentWriters,
      currentIsPrivate,
      channelType
    );

    try {
      setIsCreating(true);
      await createChannel({
        groupId,
        title: channelTitle,
        channelType,
        readers: finalReaders,
        writers: finalWriters,
      });

      navigation.navigate('ManageChannels', { groupId }, { pop: true });
    } catch (cause) {
      toast({
        message:
          cause instanceof Error
            ? cause.message
            : 'Could not create this channel',
      });
    } finally {
      setIsCreating(false);
    }
  }, [navigation, groupId, form, channelTitle, channelType, toast]);

  return (
    <SettingsListScreenView
      title="Channel permissions"
      sections={
        group
          ? channelAccessSections({
              groupRoles: group.roles ?? [],
              channelType,
              isPrivate,
              readers,
              writers,
              onChange: handleAccessChange,
              onCreateRole: handleCreateRole,
            })
          : []
      }
      loading={!group}
      onBackPressed={() => navigation.goBack()}
      showsBackOnWideWindows
      useHorizontalTitleLayout={!isWindowNarrow}
      maxWidth={SETTINGS_LIST_COLUMN_WIDTH}
      rightActions={[
        {
          id: 'CreateChannelButton',
          text: 'Create',
          tint: '$positiveActionText',
          prominent: true,
          // Not until the workspace has loaded and its roles can be picked.
          disabled: isCreating || !group,
          onPress: handleCreateChannel,
          testID: 'CreateChannelButton',
        },
      ]}
    />
  );
}
