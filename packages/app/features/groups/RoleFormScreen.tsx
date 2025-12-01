import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { createDevLogger } from '@tloncorp/shared';
import { generateSafeId } from '@tloncorp/shared/logic';
import { ConfirmDialog, useToast } from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Keyboard } from 'react-native';
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

type AddRoleProps = NativeStackScreenProps<
  GroupSettingsStackParamList,
  'AddRole'
>;
type EditRoleProps = NativeStackScreenProps<
  GroupSettingsStackParamList,
  'EditRole'
>;

type Props = AddRoleProps | EditRoleProps;

type RoleFormData = {
  title: string;
  description: string;
};

export function RoleFormScreen({ navigation, route }: Props) {
  const isEditMode = route.name === 'EditRole';
  const { groupId } = route.params;
  const roleId = isEditMode
    ? (route.params as EditRoleProps['route']['params']).roleId
    : undefined;
  const { bottom } = useSafeAreaInsets();
  const isSavingRef = useRef(false);
  const toast = useToast();
  const logger = createDevLogger('saveRole', true);

  const {
    groupRoles,
    groupChannels,
    groupMembers,
    createGroupRole,
    updateGroupRole,
    deleteGroupRole,
    addUserToRole,
    removeUserFromRole,
  } = useGroupContext({
    groupId,
  });

  const role = useMemo(
    () => (isEditMode ? groupRoles.find((r) => r.id === roleId) : undefined),
    [isEditMode, groupRoles, roleId]
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

  // Get current members with this role (for edit mode)
  const initialMembers = useMemo(() => {
    if (!isEditMode || !roleId) return [];
    return groupMembers
      .filter((m) => m.roles?.some((r) => r.roleId === roleId))
      .map((m) => m.contactId);
  }, [isEditMode, groupMembers, roleId]);

  const [selectedMembers, setSelectedMembers] =
    useState<string[]>(initialMembers);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const pendingNavigationAction = useRef<any>(null);

  // Update selectedMembers when returning from SelectRoleMembers screen
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (route.params.selectedMembers) {
        setSelectedMembers(route.params.selectedMembers);
      }
    });

    return unsubscribe;
  }, [navigation, route.params.selectedMembers]);

  // Check if there are unsaved changes
  const hasMemberChanges = useMemo(() => {
    if (!isEditMode) {
      return selectedMembers.length > 0;
    }

    const initialSet = new Set(initialMembers);
    const currentSet = new Set(selectedMembers);

    if (initialSet.size !== currentSet.size) return true;

    for (const id of currentSet) {
      if (!initialSet.has(id)) return true;
    }

    return false;
  }, [isEditMode, initialMembers, selectedMembers]);

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

      // Store the navigation action and show confirm dialog
      pendingNavigationAction.current = e.data.action;
      setDiscardDialogOpen(true);
    });

    return unsubscribe;
  }, [navigation, hasUnsavedChanges]);

  const handleDiscardConfirm = useCallback(() => {
    if (pendingNavigationAction.current) {
      navigation.dispatch(pendingNavigationAction.current);
      pendingNavigationAction.current = null;
    }
    setDiscardDialogOpen(false);
  }, [navigation]);

  const handleGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const rolesWithMembers = useMemo(() => {
    if (!isEditMode) return [];
    return groupRoles.filter((r) => {
      return groupMembers.some((member) =>
        member.roles.map((mr) => mr.roleId).includes(r.id!)
      );
    });
  }, [isEditMode, groupRoles, groupMembers]);

  const channelsCurrentlyInUse = useMemo(() => {
    if (!isEditMode || !role) return [];
    return groupChannels.filter((channel) => {
      const writers = channel.writerRoles.map((r) => r.roleId);
      const readers = channel.readerRoles.map((r) => r.roleId);
      return writers.includes(role.id!) || readers.includes(role.id!);
    });
  }, [isEditMode, role, groupChannels]);

  const handleSave = useCallback(
    async (data: { title: string; description: string }) => {
      if (!data.title) {
        return;
      }
      isSavingRef.current = true;

      try {
        if (isEditMode && role) {
          // Edit existing role
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

          // Add new members to and remove members from the role
          await Promise.all([
            ...addMembers.map((contactId) =>
              addUserToRole(contactId, role.id!)
            ),
            ...removeMembers.map((contactId) =>
              removeUserFromRole(contactId, role.id!)
            ),
          ]);
        } else {
          // Create new role
          const newRoleId = generateSafeId(data.title, 'role');
          await createGroupRole({
            id: newRoleId,
            title: data.title,
            description: data.description,
          });
          // Add selected members to the role
          await Promise.all(
            selectedMembers.map((contactId) =>
              addUserToRole(contactId, newRoleId)
            )
          );
        }

        reset();
        setSelectedMembers([]);
        navigation.goBack();
      } catch (error) {
        logger.error('Failed to save role:', error);
        toast({
          message:
            error instanceof Error
              ? `Failed to save role: ${error.message}`
              : 'An error occurred while saving the role. Please try again.',
          duration: 4000,
        });
      } finally {
        isSavingRef.current = false;
      }
    },
    [
      isEditMode,
      role,
      selectedMembers,
      initialMembers,
      createGroupRole,
      updateGroupRole,
      addUserToRole,
      removeUserFromRole,
      reset,
      navigation,
      toast,
      logger,
    ]
  );

  const disableDelete = useMemo(() => {
    if (!isEditMode || !role?.id) return true;
    return (
      rolesWithMembers.some((r) => r.id === role.id) ||
      channelsCurrentlyInUse.length > 0
    );
  }, [isEditMode, role?.id, rolesWithMembers, channelsCurrentlyInUse]);

  const handleDelete = useCallback(async () => {
    if (!isEditMode || !role?.id || role.title === 'Admin') {
      return;
    }
    isSavingRef.current = true;

    try {
      await deleteGroupRole(role.id);
      navigation.goBack();
    } catch (error) {
      logger.error('Failed to delete role:', error);
      toast({
        message:
          error instanceof Error
            ? `Failed to delete role: ${error.message}`
            : 'An error occurred while deleting the role. Please try again.',
        duration: 4000,
      });
    } finally {
      isSavingRef.current = false;
    }
  }, [isEditMode, deleteGroupRole, role?.id, role?.title, navigation, toast]);

  const handleNavigateToMemberSelector = useCallback(() => {
    navigation.navigate('SelectRoleMembers', {
      groupId,
      roleId: isEditMode ? roleId : undefined,
      selectedMembers,
      onSave: (members: string[]) => {
        setSelectedMembers(members);
      },
    });
  }, [navigation, groupId, isEditMode, roleId, selectedMembers]);

  // For edit mode, don't render until role is loaded
  if (isEditMode && !role) {
    return null;
  }

  const screenTitle = isEditMode ? `Edit ${role?.title}` : 'Add role';
  const isAdminRole = isEditMode && role?.title === 'Admin';

  return (
    <View flex={1} backgroundColor="$secondaryBackground">
      <ScreenHeader backAction={handleGoBack} title={screenTitle} />
      <ScrollView
        flex={1}
        contentContainerStyle={{
          padding: '$l',
          paddingTop: '$xl',
          paddingBottom: bottom,
        }}
      >
        <YStack gap="$l">
          {isEditMode && channelsCurrentlyInUse.length > 0 && (
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
                  editable={!isAdminRole}
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
                  editable={!isAdminRole}
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
          {isEditMode && !isAdminRole && (
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
      <ConfirmDialog
        open={discardDialogOpen}
        onOpenChange={setDiscardDialogOpen}
        title="Discard changes?"
        description="You have unsaved changes. Are you sure you want to discard them?"
        confirmText="Discard"
        destructive
        onConfirm={handleDiscardConfirm}
      />
    </View>
  );
}
