import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { ScrollView, View, YStack } from 'tamagui';

import { buildSelectChannelRolesParams } from './roleSelectionNavigation';
import { useChannelEditScreen } from '../../hooks/useChannelEditScreen';
import { GroupSettingsStackParamList } from '../../navigation/types';
import {
  PermissionTable,
  PrivateChannelToggle,
} from '../../ui/components/ManageChannels/ChannelPermissions';
import { PermissionActionButtons } from '../../ui/components/ManageChannels/ChannelPermissionsContent';
import {
  ChannelPrivacyFormSchema,
  addRoleIdToSelection,
  getChannelPrivacyDefaults,
  getChannelPrivacyToggleValues,
  getSelectedRolePermissions,
  processFinalPermissions,
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

  const form = useForm<ChannelPrivacyFormSchema>({
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
    form.setValue(
      'readers',
      addRoleIdToSelection(form.getValues('readers'), createdRoleId)
    );
    form.setValue('isPrivate', true);
  }, [createdRoleId, form]);

  // Handle roles selected from SelectChannelRoles screen
  useEffect(() => {
    if (!selectedRoleIds) return;
    const { readers, writers } = getSelectedRolePermissions(
      selectedRoleIds,
      form.getValues('writers')
    );
    form.setValue('readers', readers);
    form.setValue('writers', writers);
    form.setValue('isPrivate', true);
  }, [selectedRoleIds, form]);

  const handleTogglePrivate = useCallback(
    (value: boolean) => {
      const nextValues = getChannelPrivacyToggleValues(value);
      form.setValue('isPrivate', nextValues.isPrivate);
      form.setValue('readers', nextValues.readers);
      form.setValue('writers', nextValues.writers);
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
    navigation.navigate(
      'SelectChannelRoles',
      buildSelectChannelRolesParams({
        groupId,
        selectedRoleIds: form.getValues('readers'),
        returnScreen: 'EditChannelPrivacy',
        returnParams: {
          groupId,
          channelId,
          fromChatDetails,
        },
      })
    );
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
            <PermissionTable
              groupRoles={group.roles ?? []}
              onPressRole={handlePressRole}
            />
            {isPrivate && (
              <PermissionActionButtons onSelectRoles={handleSelectRoles} />
            )}
          </YStack>
        </ScrollView>
      </View>
    </FormProvider>
  );
}
