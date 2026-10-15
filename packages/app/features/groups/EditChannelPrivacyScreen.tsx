import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { notesPermissionsCompatActive } from '@tloncorp/shared/logic/notesPermissionsCompat';
import { useIsWindowNarrow } from '@tloncorp/ui';
import { useCallback, useEffect, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Platform } from 'react-native';

import { useChannelEditScreen } from '../../hooks/useChannelEditScreen';
import { GroupSettingsStackParamList } from '../../navigation/types';
import {
  MEMBERS_MARKER,
  getChannelPrivacyDefaults,
  processFinalPermissions,
} from '../../ui/components/ManageChannels/channelFormUtils';
import { channelAccessSections } from '../../ui/components/ManageChannels/channelAccessSections';
import { channelPermissionSections } from '../../ui/components/ManageChannels/channelPermissionSections';
import {
  SETTINGS_LIST_COLUMN_WIDTH,
  type SettingsSectionModel,
  SettingsListScreenView,
} from '../../ui/components/SettingsList';

type Props = NativeStackScreenProps<
  GroupSettingsStackParamList,
  'EditChannelPrivacy'
>;

export function EditChannelPrivacyScreen(props: Props) {
  const { groupId, channelId, fromChatDetails, createdRoleId } =
    props.route.params;
  const { navigation } = props;

  const { channel, group, updateChannel, handleGoBack } = useChannelEditScreen({
    groupId,
    channelId,
  });

  const form = useForm({
    defaultValues: {
      isPrivate: false,
      readers: [] as string[],
      writers: [] as string[],
    },
  });

  const isPrivate = useWatch({ control: form.control, name: 'isPrivate' });
  const readers = useWatch({ control: form.control, name: 'readers' });
  const writers = useWatch({ control: form.control, name: 'writers' });
  const isWindowNarrow = useIsWindowNarrow();
  // Prototype: one access level per role, from a native menu, on iOS.
  const accessLevels = Platform.OS === 'ios';
  const usesNotesPermissionsCompat = notesPermissionsCompatActive(
    channel?.type
  );
  const { isDirty } = form.formState;
  const channelIdRef = useRef(channel?.id);

  // Reset form when channel data loads or channel changes, but not when
  // background DB updates arrive while the user has unsaved edits.
  useEffect(() => {
    if (!channel) return;
    if (channel.id !== channelIdRef.current || !isDirty) {
      channelIdRef.current = channel.id;
      const defaults = getChannelPrivacyDefaults(channel);
      form.reset({
        isPrivate: defaults.isPrivate,
        readers: defaults.readers,
        writers: defaults.writers,
      });
    }
  }, [channel, form, isDirty]);

  // Handle newly created role returned from AddRole screen
  useEffect(() => {
    if (!createdRoleId) return;
    if (accessLevels) {
      // Prototype: the new role starts one step above everyone; on an open
      // channel it is simply the same as everyone.
      const current = form.getValues();
      if (!current.isPrivate) return;
      const everyoneSees = current.readers.includes(MEMBERS_MARKER);
      form.setValue(
        'readers',
        [...new Set([...current.readers, createdRoleId])],
        { shouldDirty: true }
      );
      if (everyoneSees || usesNotesPermissionsCompat) {
        form.setValue(
          'writers',
          [...new Set([...current.writers, createdRoleId])],
          { shouldDirty: true }
        );
      }
      return;
    }
    const currentReaders = form.getValues('readers');
    if (!currentReaders.includes(createdRoleId)) {
      const base = currentReaders.includes('admin')
        ? currentReaders
        : ['admin', ...currentReaders];
      form.setValue('readers', [...base, createdRoleId], {
        shouldDirty: true,
      });
      if (usesNotesPermissionsCompat) {
        form.setValue('writers', [...base, createdRoleId], {
          shouldDirty: true,
        });
      }
      form.setValue('isPrivate', true, { shouldDirty: true });
    }
  }, [accessLevels, createdRoleId, form, usesNotesPermissionsCompat]);

  const handleAccessChange = useCallback(
    (access: { isPrivate: boolean; readers: string[]; writers: string[] }) => {
      form.setValue('isPrivate', access.isPrivate, { shouldDirty: true });
      form.setValue('readers', access.readers, { shouldDirty: true });
      form.setValue('writers', access.writers, { shouldDirty: true });
    },
    [form]
  );

  const handleTogglePrivate = useCallback(
    (value: boolean) => {
      form.setValue('isPrivate', value, { shouldDirty: true });
      if (value) {
        form.setValue('readers', ['admin', MEMBERS_MARKER], {
          shouldDirty: true,
        });
        form.setValue('writers', ['admin', MEMBERS_MARKER], {
          shouldDirty: true,
        });
      } else {
        form.setValue('readers', [], { shouldDirty: true });
        form.setValue('writers', [], { shouldDirty: true });
      }
    },
    [form]
  );

  const handleCreateRole = useCallback(() => {
    navigation.navigate('AddRole', {
      groupId,
      returnScreen: 'EditChannelPrivacy',
      returnParams: { groupId, channelId, fromChatDetails },
    });
  }, [navigation, groupId, channelId, fromChatDetails]);

  const handlePermissionsChange = useCallback(
    ({ readers, writers }: { readers: string[]; writers: string[] }) => {
      form.setValue('readers', readers, { shouldDirty: true });
      form.setValue('writers', writers, { shouldDirty: true });
    },
    [form]
  );

  const handleSave = useCallback(() => {
    if (!channel) return;

    const {
      readers: currentReaders,
      writers: currentWriters,
      isPrivate: currentIsPrivate,
    } = form.getValues();
    const { finalReaders, finalWriters } = processFinalPermissions(
      currentReaders,
      currentWriters,
      currentIsPrivate,
      channel.type
    );

    updateChannel({ ...channel }, finalReaders, finalWriters);
    handleGoBack();
  }, [channel, form, updateChannel, handleGoBack]);

  const sections: SettingsSectionModel[] = accessLevels
    ? group && channel
      ? channelAccessSections({
          groupRoles: group.roles ?? [],
          channelType: channel.type,
          isPrivate,
          readers,
          writers,
          onChange: handleAccessChange,
          onCreateRole: handleCreateRole,
        })
      : []
    : [
        {
          key: 'custom',
          footer: isPrivate
            ? 'Only the roles you choose can see this channel.'
            : 'Everyone in the group can see and post in this channel.',
          rows: [
            {
              key: 'custom',
              title: 'Custom permissions',
              toggle: { value: isPrivate, onValueChange: handleTogglePrivate },
              testID: 'PrivateChannelToggle',
            },
          ],
        },
        ...(isPrivate && group && channel
          ? channelPermissionSections({
              groupRoles: group.roles ?? [],
              channelType: channel.type,
              readers,
              writers,
              onChange: handlePermissionsChange,
              onCreateRole: handleCreateRole,
            })
          : []),
      ];

  return (
    <SettingsListScreenView
      title="Channel permissions"
      sections={sections}
      loading={!group || !channel}
      onBackPressed={handleGoBack}
      showsBackOnWideWindows
      useHorizontalTitleLayout={!isWindowNarrow}
      maxWidth={SETTINGS_LIST_COLUMN_WIDTH}
      rightActions={[
        {
          id: 'ChannelPrivacySaveButton',
          text: 'Save',
          tint: '$positiveActionText',
          prominent: true,
          disabled: !channel || !isDirty,
          onPress: handleSave,
          testID: 'ChannelPrivacySaveButton',
        },
      ]}
    />
  );
}
