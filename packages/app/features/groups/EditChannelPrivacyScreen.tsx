import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
  useChannelPermissionState,
  usePermissionFormSync,
} from '../../ui/components/ManageChannels/ChannelPermissionsContent';
import { getChannelPrivacyDefaults } from '../../ui/components/ManageChannels/channelFormUtils';
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

  // Get initial values from channel
  const initialValues = useMemo(
    () => getChannelPrivacyDefaults(channel),
    [channel]
  );

  const [isPrivate, setIsPrivate] = useState(initialValues.isPrivate);

  const { readers, setReaders, writers, setWriters } =
    useChannelPermissionState({
      initialReaders: initialValues.readers,
      initialWriters: initialValues.writers,
      createdRoleId,
      selectedRoleIds,
      onCreatedRoleProcessed: useCallback(() => setIsPrivate(true), []),
      onSelectedRolesProcessed: useCallback(() => setIsPrivate(true), []),
    });

  // Reset state when channel data loads
  useEffect(() => {
    if (channel) {
      const defaults = getChannelPrivacyDefaults(channel);
      // Only reset isPrivate from defaults if we don't have selectedRoleIds
      // (selectedRoleIds means user just selected roles and expects private mode)
      if (!selectedRoleIds) {
        setIsPrivate(defaults.isPrivate);
        setReaders(defaults.readers);
      } else {
        // If we have selectedRoleIds, ensure private mode is on
        setIsPrivate(true);
      }
      setWriters(defaults.writers);
    }
  }, [channel, selectedRoleIds, setReaders, setWriters]);

  // Create form for PermissionTable
  const form = useForm({
    defaultValues: {
      isPrivate,
      readers,
      writers,
    },
  });

  usePermissionFormSync(form.setValue, readers, writers, isPrivate);

  const handleTogglePrivate = useCallback(
    (value: boolean) => {
      setIsPrivate(value);
      if (value) {
        setReaders(['admin']);
        setWriters(['admin']);
      } else {
        setReaders([]);
        setWriters([]);
      }
    },
    [setReaders, setWriters]
  );

  const handleSelectRoles = useCallback(() => {
    navigation.navigate('SelectChannelRoles', {
      groupId,
      selectedRoleIds: readers,
      returnScreen: 'EditChannelPrivacy',
      returnParams: {
        groupId,
        channelId,
        fromChatDetails,
      },
    });
  }, [navigation, groupId, channelId, fromChatDetails, readers]);

  const handleCreateRole = useCallback(() => {
    navigation.navigate('AddRole', {
      groupId,
      fromChatDetails,
      returnScreen: 'EditChannelPrivacy',
      returnParams: {
        groupId,
        channelId,
        fromChatDetails,
      },
    });
  }, [navigation, groupId, channelId, fromChatDetails]);

  const handleSave = useCallback(() => {
    if (!channel) return;

    const { finalReaders, finalWriters } = processFinalPermissions(
      readers,
      writers,
      isPrivate
    );

    updateChannel({ ...channel }, finalReaders, finalWriters);
    handleGoBack();
  }, [channel, isPrivate, readers, writers, updateChannel, handleGoBack]);

  if (!group || !channel) {
    return null;
  }

  return (
    <FormProvider {...form}>
      <View backgroundColor="$background" flex={1}>
        <ScreenHeader
          title="Channel privacy"
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
            <PermissionTable groupRoles={group.roles ?? []} />
            {isPrivate && (
              <PermissionActionButtons
                onSelectRoles={handleSelectRoles}
                onCreateRole={handleCreateRole}
              />
            )}
          </YStack>
        </ScrollView>
      </View>
    </FormProvider>
  );
}
