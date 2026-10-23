import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { createDevLogger } from '@tloncorp/shared';
import type * as db from '@tloncorp/shared/db';
import { generateSafeId, isRosterWhole } from '@tloncorp/shared/logic';
import * as store from '@tloncorp/shared/store';
import { ConfirmDialog, useToast } from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useGroupContext } from '../../hooks/useGroupContext';
import { GroupSettingsStackParamList } from '../../navigation/types';
import {
  SETTINGS_LIST_COLUMN_WIDTH,
  type SettingsSectionModel,
  SettingsListScreenView,
} from '../../ui/components/SettingsList';
import {
  NO_MEMBER_EDITS,
  applyMemberEdits,
  editMembers,
} from './roleMemberEdits';

type AddRoleProps = NativeStackScreenProps<
  GroupSettingsStackParamList,
  'AddRole'
>;
type EditRoleProps = NativeStackScreenProps<
  GroupSettingsStackParamList,
  'EditRole'
>;

type Props = AddRoleProps | EditRoleProps;

const logger = createDevLogger('saveRole', true);

export function RoleFormScreen({ navigation, route }: Props) {
  const isEditMode = route.name === 'EditRole';
  const roleId = isEditMode
    ? (route.params as EditRoleProps['route']['params']).roleId
    : undefined;
  // the same sync as the form's, so it doesn't also start a light one
  const { groupRoles } = useGroupContext({
    groupId: route.params.groupId,
    wholeRoster: true,
  });
  const role = isEditMode ? groupRoles.find((r) => r.id === roleId) : undefined;

  // The form starts from the role's values, so it waits for the role.
  if (isEditMode && !role) {
    return null;
  }

  return <RoleForm navigation={navigation} route={route} role={role} />;
}

function RoleForm({
  navigation,
  route,
  role,
}: {
  navigation: Props['navigation'];
  route: Props['route'];
  role: db.GroupRole | undefined;
}) {
  const isEditMode = route.name === 'EditRole';
  const { groupId } = route.params;
  const roleId = role?.id ?? undefined;
  const isSavingRef = useRef(false);
  const toast = useToast();

  const {
    group,
    groupRoles,
    groupChannels,
    groupMembers,
    createGroupRole,
    updateGroupRole,
    deleteGroupRole,
    addUserToRole,
    removeUserFromRole,
    // a role's holders come from the stored roster, so load all of it
  } = useGroupContext({
    groupId,
    wholeRoster: true,
  });

  const initialTitle = role?.title ?? '';
  const initialDescription = role?.description ?? '';
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [titleWasEdited, setTitleWasEdited] = useState(false);
  const isValid = title.trim().length > 0;
  const isDirty = title !== initialTitle || description !== initialDescription;

  // Get current members with this role (for edit mode)
  const initialMembers = useMemo(() => {
    if (!isEditMode || !roleId) return [];
    return groupMembers
      .filter((m) => m.roles?.some((r) => r.roleId === roleId))
      .map((m) => m.contactId);
  }, [isEditMode, groupMembers, roleId]);

  // A big group's roster syncs whole only once role management opens, so
  // holders can still be landing after this form mounts. A selection fixed
  // at mount would drop every late arrival from the role on save, so only
  // the user's own changes are kept, over whatever holders have loaded.
  const [memberEdits, setMemberEdits] = useState(NO_MEMBER_EDITS);
  const selectedMembers = useMemo(
    () => applyMemberEdits(initialMembers, memberEdits),
    [initialMembers, memberEdits]
  );
  // the selection the member picker was opened with
  const pickerBaseline = useRef<string[]>([]);
  const setSelectedMembers = useCallback((members: string[]) => {
    setMemberEdits((edits) =>
      editMembers(edits, pickerBaseline.current, members)
    );
  }, []);
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
  }, [navigation, route.params.selectedMembers, setSelectedMembers]);

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

  const handleSave = useCallback(async () => {
    if (!isValid) {
      return;
    }
    isSavingRef.current = true;

    try {
      if (isEditMode && role) {
        const addMembers = selectedMembers.filter(
          (id) => !initialMembers.includes(id)
        );
        const removeMembers = initialMembers.filter(
          (id) => !selectedMembers.includes(id)
        );

        await updateGroupRole({ ...role, title, description });

        await Promise.all([
          ...addMembers.map((contactId) => addUserToRole(contactId, role.id!)),
          ...removeMembers.map((contactId) =>
            removeUserFromRole(contactId, role.id!)
          ),
        ]);
      } else {
        const newRoleId = generateSafeId(title, 'role');
        await createGroupRole({ id: newRoleId, title, description });
        await Promise.all(
          selectedMembers.map((contactId) =>
            addUserToRole(contactId, newRoleId)
          )
        );

        if ('returnScreen' in route.params && route.params.returnScreen) {
          const { returnScreen, returnParams } = route.params;
          // Back to the screen that asked for a role, which picks it.
          navigation.navigate(
            returnScreen,
            { ...returnParams, createdRoleId: newRoleId } as never,
            { pop: true }
          );
          return;
        }
      }

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
  }, [
    isValid,
    isEditMode,
    role,
    title,
    description,
    selectedMembers,
    initialMembers,
    createGroupRole,
    updateGroupRole,
    addUserToRole,
    removeUserFromRole,
    navigation,
    route.params,
    toast,
  ]);

  // syncedAt outlives the session, but holders can change while we're away,
  // so the roster is only whole once a sync this session has landed
  const sessionStartTime = store.useCurrentSession()?.startTime;
  const rosterIsWhole = isRosterWhole(group?.syncedAt, sessionStartTime);

  const disableDelete = useMemo(() => {
    if (!isEditMode || !role?.id) return true;
    return (
      // until the whole roster lands, an unloaded holder can make a role in
      // use look unused
      !rosterIsWhole ||
      rolesWithMembers.some((r) => r.id === role.id) ||
      channelsCurrentlyInUse.length > 0
    );
  }, [
    isEditMode,
    role?.id,
    rosterIsWhole,
    rolesWithMembers,
    channelsCurrentlyInUse,
  ]);

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
    pickerBaseline.current = selectedMembers;
    navigation.navigate('SelectRoleMembers', {
      groupId,
      roleId: isEditMode ? roleId : undefined,
      selectedMembers,
      onSave: setSelectedMembers,
    });
  }, [
    navigation,
    groupId,
    isEditMode,
    roleId,
    selectedMembers,
    setSelectedMembers,
  ]);

  const isAdminRole = isEditMode && role?.title === 'Admin';

  const sections = useMemo<SettingsSectionModel[]>(() => {
    const all: SettingsSectionModel[] = [
      {
        key: 'in-use',
        title: 'Channels using this role',
        rows: channelsCurrentlyInUse.map((channel) => ({
          key: channel.id,
          title: channel.title ?? '',
        })),
      },
      {
        key: 'title',
        title: 'Name',
        footer:
          titleWasEdited && !isValid ? 'Role title is required' : undefined,
        rows: [
          {
            key: 'title',
            title: 'Name',
            disabled: isAdminRole,
            textField: {
              value: title,
              onChangeText: (text) => {
                setTitle(text);
                setTitleWasEdited(true);
              },
              placeholder: 'Role name',
              capitalization: 'words',
            },
            testID: 'RoleTitleInput',
          },
        ],
      },
      {
        key: 'description',
        title: 'Description',
        rows: [
          {
            key: 'description',
            title: 'Description',
            disabled: isAdminRole,
            textField: {
              value: description,
              onChangeText: setDescription,
              placeholder: 'What this role is for',
              lines: 5,
              capitalization: 'sentences',
            },
            testID: 'RoleDescriptionInput',
          },
        ],
      },
      {
        key: 'members',
        rows: [
          {
            key: 'members',
            title: 'Members',
            value: String(selectedMembers.length),
            // the picker starts from the holders loaded when it opens, so it
            // waits for the whole roster
            disabled: !rosterIsWhole,
            onPress: handleNavigateToMemberSelector,
          },
        ],
      },
      {
        key: 'delete',
        footer: disableDelete
          ? 'This role cannot be deleted, it is still in use for some users or channels.'
          : undefined,
        rows:
          isEditMode && !isAdminRole
            ? [
                {
                  key: 'delete',
                  title: 'Delete role',
                  destructive: true,
                  disabled: disableDelete,
                  onPress: handleDelete,
                  testID: 'DeleteRoleButton',
                },
              ]
            : [],
      },
    ];
    return all.filter((section) => section.rows.length > 0);
  }, [
    channelsCurrentlyInUse,
    description,
    disableDelete,
    handleDelete,
    handleNavigateToMemberSelector,
    isAdminRole,
    isEditMode,
    isValid,
    rosterIsWhole,
    selectedMembers.length,
    title,
    titleWasEdited,
  ]);

  return (
    <SettingsListScreenView
      title={isEditMode ? `Edit ${role?.title}` : 'Add role'}
      sections={sections}
      onBackPressed={handleGoBack}
      showsBackOnWideWindows
      maxWidth={SETTINGS_LIST_COLUMN_WIDTH}
      rightActions={[
        {
          id: 'RoleSaveButton',
          text: 'Save',
          tint: '$positiveActionText',
          prominent: true,
          // A new role can be saved as soon as it has a title; an existing one
          // once something about it has changed.
          disabled: !isValid || (isEditMode && !hasUnsavedChanges),
          onPress: handleSave,
        },
      ]}
    >
      <ConfirmDialog
        open={discardDialogOpen}
        onOpenChange={setDiscardDialogOpen}
        title="Discard changes?"
        description="You have unsaved changes. Are you sure you want to discard them?"
        confirmText="Discard"
        destructive
        onConfirm={handleDiscardConfirm}
      />
    </SettingsListScreenView>
  );
}
