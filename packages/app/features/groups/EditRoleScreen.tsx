import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/db';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
import { Badge } from '../../ui/components/Badge';

type Props = NativeStackScreenProps<GroupSettingsStackParamList, 'EditRole'>;

type RoleFormData = {
  title: string;
  description: string;
};

export function EditRoleScreen({ navigation, route }: Props) {
  const { groupId, roleId } = route.params;
  const { bottom } = useSafeAreaInsets();
  const isSavingRef = useRef(false);

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
    formState: { errors, isValid, isDirty },
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

  // Check if there are unsaved changes
  const hasMemberChanges = useMemo(() => {
    const initialSet = new Set(initialMembers);
    const currentSet = new Set(selectedMembers);

    if (initialSet.size !== currentSet.size) return true;

    for (const id of currentSet) {
      if (!initialSet.has(id)) return true;
    }

    return false;
  }, [initialMembers, selectedMembers]);

  const hasUnsavedChanges = isDirty || hasMemberChanges;

  // Intercept back navigation to prompt for unsaved changes
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      // If no unsaved changes or already saving, let navigation proceed
      if (!hasUnsavedChanges || isSavingRef.current) {
        return;
      }

      // Prevent default behavior of leaving the screen
      e.preventDefault();

      // Prompt the user before leaving the screen
      Alert.alert(
        'Discard changes?',
        'You have unsaved changes. Are you sure you want to discard them?',
        [
          { text: "Don't leave", style: 'cancel', onPress: () => {} },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => navigation.dispatch(e.data.action),
          },
        ]
      );
    });

    return unsubscribe;
  }, [navigation, hasUnsavedChanges]);

  const handleGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

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
      isSavingRef.current = true;

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
    isSavingRef.current = true;
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
      <ScreenHeader backAction={handleGoBack} title={`Edit ${role.title}`} />
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
              paddingHorizontal="$2xl"
              backgroundColor="$background"
              borderRadius="$xl"
            >
              <ListItem.MainContent>
                <ListItem.Title>Members</ListItem.Title>
              </ListItem.MainContent>
              <ListItem.EndContent
                flexDirection="row"
                gap="$xl"
                alignItems="center"
              >
                {selectedMembers.length > 0 ? (
                  <ListItem.Count
                    notified={false}
                    count={selectedMembers.length}
                  />
                ) : (
                  <Badge text="Add" />
                )}

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
                <Button.Text
                  color={disableDelete ? '$negativeActionText' : undefined}
                >
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
