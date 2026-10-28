import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useIsWindowNarrow } from '@tloncorp/ui';
import { useCallback, useEffect, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { useChannelEditScreen } from '../../hooks/useChannelEditScreen';
import { GroupSettingsStackParamList } from '../../navigation/types';
import {
  type ChannelAccess,
  channelAccessSections,
  withCreatedRole,
} from '../../ui/components/ManageChannels/channelAccessSections';
import {
  getChannelPrivacyDefaults,
  processFinalPermissions,
} from '../../ui/components/ManageChannels/channelFormUtils';
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
    const next = withCreatedRole(current, createdRoleId, channel?.type);
    if (next !== current) {
      handleAccessChange(next);
    }
  }, [channel?.type, createdRoleId, form, handleAccessChange]);

  const handleCreateRole = useCallback(() => {
    navigation.navigate('AddRole', {
      groupId,
      returnScreen: 'EditChannelPrivacy',
      returnParams: { groupId, channelId, fromChatDetails },
    });
  }, [navigation, groupId, channelId, fromChatDetails]);

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

  const sections: SettingsSectionModel[] =
    group && channel
      ? channelAccessSections({
          groupRoles: group.roles ?? [],
          channelType: channel.type,
          isPrivate,
          readers,
          writers,
          onChange: handleAccessChange,
          onCreateRole: handleCreateRole,
        })
      : [];

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
