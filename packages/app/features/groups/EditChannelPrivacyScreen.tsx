import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { ScrollView, View, YStack } from 'tamagui';

import { useChannelEditScreen } from '../../hooks/useChannelEditScreen';
import { GroupSettingsStackParamList } from '../../navigation/types';
import {
  PermissionTable,
  PrivateChannelToggle,
} from '../../ui/components/ManageChannels/ChannelPermissions';
import {
  PermissionActionButtons,
  processFinalPermissions,
} from '../../ui/components/ManageChannels/ChannelPermissionsContent';
import {
  MEMBERS_MARKER,
  getChannelPrivacyDefaults,
} from '../../ui/components/ManageChannels/channelFormUtils';
import { ScreenHeader } from '../../ui/components/ScreenHeader';

type Props = NativeStackScreenProps<
  GroupSettingsStackParamList,
  'EditChannelPrivacy'
>;

export function EditChannelPrivacyScreen(props: Props) {
  const {
    groupId,
    channelId,
    fromChatDetails,
    createdRoleId,
    selectedRoleIds,
  } = props.route.params;
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

  const isPrivate = form.watch('isPrivate');

  // Reset form when channel data loads
  useEffect(() => {
    if (!channel) return;
    const defaults = getChannelPrivacyDefaults(channel);
    if (!selectedRoleIds) {
      form.reset({
        isPrivate: defaults.isPrivate,
        readers: defaults.readers,
        writers: defaults.writers,
      });
    } else {
      form.setValue('isPrivate', true);
      form.setValue('writers', defaults.writers);
    }
  }, [channel, selectedRoleIds, form]);

  // Handle newly created role returned from AddRole screen
  useEffect(() => {
    if (!createdRoleId) return;
    const currentReaders = form.getValues('readers');
    if (!currentReaders.includes(createdRoleId)) {
      const base = currentReaders.includes('admin')
        ? currentReaders
        : ['admin', ...currentReaders];
      form.setValue('readers', [...base, createdRoleId]);
      form.setValue('isPrivate', true);
    }
  }, [createdRoleId, form]);

  // Handle roles selected from SelectChannelRoles screen
  useEffect(() => {
    if (!selectedRoleIds) return;
    form.setValue('readers', selectedRoleIds);
    const currentWriters = form.getValues('writers');
    form.setValue(
      'writers',
      currentWriters.filter((w) => selectedRoleIds.includes(w))
    );
    form.setValue('isPrivate', true);
  }, [selectedRoleIds, form]);

  const handleTogglePrivate = useCallback(
    (value: boolean) => {
      form.setValue('isPrivate', value);
      if (value) {
        form.setValue('readers', ['admin', MEMBERS_MARKER]);
        form.setValue('writers', ['admin', MEMBERS_MARKER]);
      } else {
        form.setValue('readers', []);
        form.setValue('writers', []);
      }
    },
    [form]
  );

  const handlePressRole = useCallback(
    (roleId: string) => {
      navigation.navigate('EditRole', {
        groupId,
        roleId,
      });
    },
    [navigation, groupId]
  );

  const handleSelectRoles = useCallback(() => {
    const currentReaders = form.getValues('readers');
    navigation.navigate('SelectChannelRoles', {
      groupId,
      selectedRoleIds: currentReaders,
      returnScreen: 'EditChannelPrivacy',
      returnParams: {
        groupId,
        channelId,
        fromChatDetails,
      },
    });
  }, [navigation, groupId, channelId, fromChatDetails, form]);

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
      currentIsPrivate
    );

    updateChannel({ ...channel }, finalReaders, finalWriters);
    handleGoBack();
  }, [channel, form, updateChannel, handleGoBack]);

  if (!group || !channel) {
    return null;
  }

  return (
    <FormProvider {...form}>
      <View backgroundColor="$background" flex={1}>
        <ScreenHeader
          title="Channel permissions"
          backAction={handleGoBack}
          rightControls={
            <ScreenHeader.TextButton
              onPress={handleSave}
              color="$positiveActionText"
              testID="ChannelPrivacySaveButton"
            >
              Save
            </ScreenHeader.TextButton>
          }
        />
        <ScrollView flex={1}>
          <YStack gap="$2xl" padding="$xl">
            <YStack
              width="100%"
              overflow="hidden"
              borderRadius="$m"
              borderWidth={1}
              borderColor="$secondaryBorder"
            >
              <PrivateChannelToggle
                isPrivate={isPrivate}
                onTogglePrivate={handleTogglePrivate}
              />
            </YStack>
            <PermissionTable groupRoles={group.roles ?? []} onPressRole={handlePressRole} />
            {isPrivate && (
              <PermissionActionButtons onSelectRoles={handleSelectRoles} />
            )}
          </YStack>
        </ScrollView>
      </View>
    </FormProvider>
  );
}
