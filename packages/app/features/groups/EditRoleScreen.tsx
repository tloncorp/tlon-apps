import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/db';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useHandleGoBack } from '../../hooks/useChatSettingsNavigation';
import { useGroupContext } from '../../hooks/useGroupContext';
import { GroupSettingsStackParamList } from '../../navigation/types';
import {
  ActionSheet,
  Button,
  Field,
  ListItem,
  Pressable,
  ScreenHeader,
  ScrollView,
  Text,
  TextInput,
  View,
  YStack,
} from '../../ui';

type Props = NativeStackScreenProps<GroupSettingsStackParamList, 'EditRole'>;

type RoleFormData = {
  title: string;
  description: string;
};

export function EditRoleScreen({ navigation, route }: Props) {
  const { groupId, roleId, fromChatDetails } = route.params;
  const { bottom } = useSafeAreaInsets();

  const {
    groupRoles,
    groupChannels,
    groupMembers,
    updateGroupRole,
    deleteGroupRole,
    addUserToRole,
    removeUserFromRole,
  } = useGroupContext({
    groupId,
  });

  const role = useMemo(
    () => groupRoles.find((r) => r.id === roleId),
    [groupRoles, roleId]
  );

  const {
    reset,
    control,
    handleSubmit,
    formState: { errors, isValid },
    trigger,
  } = useForm<RoleFormData>({
    defaultValues: {
      title: role?.title ?? '',
      description: role?.description ?? '',
    },
  });

  // Get current members with this role
  const initialMembers = useMemo(() => {
    return groupMembers
      .filter((m) => m.roles?.some((r) => r.roleId === roleId))
      .map((m) => m.contactId);
  }, [groupMembers, roleId]);

  const [selectedMembers, setSelectedMembers] =
    useState<string[]>(initialMembers);

  // Update selectedMembers when returning from SelectRoleMembers screen
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // If we're returning from member selection, the route params will have updated selectedMembers
      if (route.params.selectedMembers) {
        setSelectedMembers(route.params.selectedMembers);
      }
    });

    return unsubscribe;
  }, [navigation, route.params.selectedMembers]);

  const handleGoBack = useHandleGoBack(navigation, {
    groupId,
    fromChatDetails,
  });

  const rolesWithMembers = useMemo(() => {
    return groupRoles.filter((r) => {
      return groupMembers.some((member) =>
        member.roles.map((mr) => mr.roleId).includes(r.id!)
      );
    });
  }, [groupRoles, groupMembers]);

  const channelsCurrentlyInUse = useMemo(() => {
    if (!role) return [];
    return groupChannels.filter((channel) => {
      const writers = channel.writerRoles.map((r) => r.roleId);
      const readers = channel.readerRoles.map((r) => r.roleId);
      return writers.includes(role.id!) || readers.includes(role.id!);
    });
  }, [role, groupChannels]);

  const handleSave = useCallback(
    async (data: { title: string; description: string }) => {
      if (!role) {
        return;
      }
      // Calculate which members to add/remove
      const addMembers = selectedMembers.filter(
        (id) => !initialMembers.includes(id)
      );
      const removeMembers = initialMembers.filter(
        (id) => !selectedMembers.includes(id)
      );

      await updateGroupRole({
        ...role,
        title: data.title,
        description: data.description,
      });

      // Add new members to the role
      for (const contactId of addMembers) {
        await addUserToRole(contactId, role.id!);
      }
      // Remove members from the role
      for (const contactId of removeMembers) {
        await removeUserFromRole(contactId, role.id!);
      }

      reset();
      navigation.goBack();
    },
    [
      role,
      selectedMembers,
      initialMembers,
      updateGroupRole,
      addUserToRole,
      removeUserFromRole,
      reset,
      navigation,
    ]
  );

  const disableDelete = useMemo(() => {
    if (!role?.id) return true;
    return (
      rolesWithMembers.some((r) => r.id === role.id) ||
      channelsCurrentlyInUse.length > 0
    );
  }, [role?.id, rolesWithMembers, channelsCurrentlyInUse]);

  const handleDelete = useCallback(async () => {
    if (!role?.id || role.title === 'Admin') {
      return;
    }
    await deleteGroupRole(role.id);
    navigation.goBack();
  }, [deleteGroupRole, role?.id, role?.title, navigation]);

  const handleNavigateToMemberSelector = useCallback(() => {
    navigation.navigate('SelectRoleMembers', {
      groupId,
      roleId: role?.id ?? undefined,
      selectedMembers,
      onSave: (members: string[]) => {
        setSelectedMembers(members);
      },
    });
  }, [navigation, groupId, role?.id, selectedMembers]);

  if (!role) {
    return null;
  }

  return (
    <View flex={1} backgroundColor="$secondaryBackground">
      <ScreenHeader backAction={handleGoBack} title="Edit role" />
      <ScrollView
        flex={1}
        contentContainerStyle={{
          padding: '$l',
          paddingTop: '$xl',
          paddingBottom: bottom,
        }}
      >
        <YStack gap="$l">
          {channelsCurrentlyInUse.length > 0 && (
            <>
              <Text fontSize="$s" color="$tertiaryText">
                This role is currently used in the following channels:
              </Text>
              <YStack gap="$s" paddingHorizontal="$2xl">
                {channelsCurrentlyInUse.map((channel) => (
                  <Text key={channel.id} fontSize="$s">
                    • {channel.title}
                  </Text>
                ))}
              </YStack>
              <View
                borderBottomColor="$border"
                borderBottomWidth={1}
                marginVertical="$l"
              />
            </>
          )}
          <Controller
            control={control}
            name="title"
            rules={{ required: 'Role title is required' }}
            render={({ field: { onChange, onBlur, value } }) => (
              <Field label="Title" error={errors.title?.message}>
                <TextInput
                  placeholder="Role title"
                  onChangeText={onChange}
                  onBlur={() => {
                    onBlur();
                    trigger('title');
                    Keyboard.dismiss();
                  }}
                  value={value}
                  editable={role.title !== 'Admin'}
                  testID="RoleTitleInput"
                />
              </Field>
            )}
          />
          <Controller
            control={control}
            name="description"
            render={({ field: { onChange, onBlur, value } }) => (
              <Field label="Description">
                <TextInput
                  placeholder="Role description"
                  onChangeText={onChange}
                  onBlur={() => {
                    onBlur();
                    Keyboard.dismiss();
                  }}
                  value={value}
                  editable={role.title !== 'Admin'}
                  testID="RoleDescriptionInput"
                />
              </Field>
            )}
          />
          <Pressable onPress={handleNavigateToMemberSelector}>
            <ListItem
              paddingHorizontal="$xl"
              backgroundColor="$background"
              borderRadius="$xl"
            >
              <ListItem.MainContent>
                <ListItem.Title>Members</ListItem.Title>
                <ListItem.Subtitle>
                  {selectedMembers.length === 0
                    ? 'No members selected'
                    : `${selectedMembers.length} member${selectedMembers.length === 1 ? '' : 's'} selected`}
                </ListItem.Subtitle>
              </ListItem.MainContent>
              <ListItem.EndContent>
                <ActionSheet.ActionIcon
                  type="ChevronRight"
                  color="$tertiaryText"
                />
              </ListItem.EndContent>
            </ListItem>
          </Pressable>
          <Button hero onPress={handleSubmit(handleSave)} disabled={!isValid}>
            <Button.Text>Save</Button.Text>
          </Button>
          {role.title === 'Admin' ? null : (
            <YStack gap="$l">
              <Button
                heroDestructive
                disabled={disableDelete}
                onPress={handleDelete}
              >
                <Button.Text color={'$negativeActionText'}>
                  Delete role
                </Button.Text>
              </Button>
              {disableDelete && (
                <Text textAlign="center" fontSize="$s" color="$destructiveText">
                  This role cannot be deleted, it is still in use for some users
                  or channels.
                </Text>
              )}
            </YStack>
          )}
        </YStack>
      </ScrollView>
    </View>
  );
}
