import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { notesPermissionsCompatActive } from '@tloncorp/shared/logic/notesPermissionsCompat';
import { useIsWindowNarrow } from '@tloncorp/ui';
import { useCallback, useEffect, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { useChannelEditScreen } from '../../hooks/useChannelEditScreen';
import { GroupSettingsStackParamList } from '../../navigation/types';
import {
  MEMBERS_MARKER,
  getChannelPrivacyDefaults,
  processFinalPermissions,
} from '../../ui/components/ManageChannels/channelFormUtils';
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
    const currentReaders = form.getValues('readers');
    if (!currentReaders.includes(createdRoleId)) {
      const base = currentReaders.includes('admin')
        ? currentReaders
        : ['admin', ...currentReaders];
      form.setValue('readers', [...base, createdRoleId]);
      if (usesNotesPermissionsCompat) {
        form.setValue('writers', [...base, createdRoleId]);
      }
      form.setValue('isPrivate', true);
    }
  }, [createdRoleId, form, usesNotesPermissionsCompat]);

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

  const sections: SettingsSectionModel[] = [
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
          disabled: !channel,
          onPress: handleSave,
          testID: 'ChannelPrivacySaveButton',
        },
      ]}
    />
  );
}
