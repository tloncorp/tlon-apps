import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/db';
import { generateSafeId } from '@tloncorp/shared/logic';
import { useCallback, useMemo, useState } from 'react';
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

type Props = NativeStackScreenProps<GroupSettingsStackParamList, 'GroupRoles'>;

export function GroupRolesScreen(props: Props) {
  return (
    <GroupRolesScreenView navigation={props.navigation} route={props.route} />
  );
}

type GroupRolesScreenViewProps = {
  navigation: Props['navigation'];
  route: Props['route'];
};

function GroupRolesScreenView({
  navigation,
  route,
}: GroupRolesScreenViewProps) {
  const { groupId, fromChatDetails } = route.params;
  const [editRole, setEditRole] = useState<db.GroupRole | null>(null);
  const [showAddRole, setShowAddRole] = useState(false);

  const insets = useSafeAreaInsets();

  const {
    groupRoles,
    groupChannels,
    groupMembers,
    updateGroupRole,
    deleteGroupRole,
    createGroupRole,
    addUserToRole,
    removeUserFromRole,
  } = useGroupContext({
    groupId,
  });

  const handleGoBack = useHandleGoBack(navigation, {
    groupId,
    fromChatDetails,
  });

  const rolesWithMembers = useMemo(() => {
    return groupRoles.filter((role) => {
      return groupMembers.some((member) =>
        member.roles.map((r) => r.roleId).includes(role.id!)
      );
    });
  }, [groupRoles, groupMembers]);

  const rolesByChannel: {
    [channelId: string]: db.GroupRole[];
  } = useMemo(() => {
    return groupChannels.reduce(
      (acc, channel) => {
        const roles = groupRoles.filter((role) => {
          const writers = channel.writerRoles.map((r) => r.roleId);
          const readers = channel.readerRoles.map((r) => r.roleId);
          return writers.includes(role.id!) || readers.includes(role.id!);
        });
        return {
          ...acc,
          [channel.id]: roles,
        };
      },
      {} as Record<string, db.GroupRole[]>
    );
  }, [groupChannels, groupRoles]);

  const getChannelsForRole = useCallback(
    (role: db.GroupRole) => {
      return Object.entries(rolesByChannel)
        .filter(([_, roles]) => roles.includes(role))
        .map(([channelId]) => groupChannels.find((c) => c.id === channelId)!)
        .filter((c) => c !== undefined) as db.Channel[];
    },
    [rolesByChannel, groupChannels]
  );

  const getMemberCountForRole = useCallback(
    (roleId: string) => {
      return groupMembers.filter((member) =>
        member.roles?.some((r) => r.roleId === roleId)
      ).length;
    },
    [groupMembers]
  );

  const handleSetEditRole = useCallback((role: db.GroupRole) => {
    setEditRole(role);
  }, []);

  const handleAddRole = useCallback(
    async ({
      title,
      description,
      members,
    }: {
      title: string;
      description: string;
      members: string[];
    }) => {
      const roleId = generateSafeId(title, 'role');
      await createGroupRole({
        id: roleId,
        title,
        description,
      });
      // Add selected members to the role
      for (const contactId of members) {
        await addUserToRole(contactId, roleId);
      }
    },
    [createGroupRole, addUserToRole]
  );

  const handleEditRole = useCallback(
    async (
      role: db.GroupRole,
      addMembers: string[],
      removeMembers: string[]
    ) => {
      await updateGroupRole(role);
      // Add new members to the role
      for (const contactId of addMembers) {
        await addUserToRole(contactId, role.id!);
      }
      // Remove members from the role
      for (const contactId of removeMembers) {
        await removeUserFromRole(contactId, role.id!);
      }
    },
    [updateGroupRole, addUserToRole, removeUserFromRole]
  );

  const handleDeleteRole = useCallback(
    (roleId: string) => {
      deleteGroupRole(roleId);
    },
    [deleteGroupRole]
  );

  return (
    <View flex={1} backgroundColor="$secondaryBackground">
      <ScreenHeader backAction={handleGoBack} title={'Group Roles'} />
      <ScrollView
        flex={1}
        contentContainerStyle={{
          padding: '$l',
          paddingTop: '$xl',
          paddingBottom: insets.bottom,
          gap: '$3xl',
          flexDirection: 'column',
        }}
      >
        <ActionSheet.ActionGroup
          padding={0}
          contentProps={{
            backgroundColor: '$background',
            borderRadius: '$2xl',
            borderWidth: 0,
          }}
        >
          {groupRoles.map((role) => (
            <Pressable key={role.id} onPress={() => handleSetEditRole(role)}>
              <ListItem
                paddingHorizontal="$2xl"
                backgroundColor={'$background'}
                borderRadius="$2xl"
                testID={`GroupRole-${role.title}`}
              >
                <ActionSheet.ActionContent>
                  <ActionSheet.ActionTitle>
                    {role.title}
                  </ActionSheet.ActionTitle>
                  {role.description && (
                    <ListItem.Subtitle>{role.description}</ListItem.Subtitle>
                  )}
                </ActionSheet.ActionContent>

                <ListItem.EndContent
                  flexDirection="row"
                  gap="$xl"
                  alignItems="center"
                >
                  <ListItem.Count
                    notified={false}
                    count={getMemberCountForRole(role.id!)}
                  />
                  <ActionSheet.ActionIcon
                    type="ChevronRight"
                    color="$tertiaryText"
                  />
                </ListItem.EndContent>
              </ListItem>
            </Pressable>
          ))}
          <Pressable onPress={() => setShowAddRole(true)}>
            <ListItem
              paddingHorizontal="$2xl"
              backgroundColor={'$background'}
              borderRadius="$2xl"
            >
              <ActionSheet.ActionContent>
                <ActionSheet.ActionTitle>Add role</ActionSheet.ActionTitle>
              </ActionSheet.ActionContent>
              <ListItem.EndContent
                flexDirection="row"
                gap="$xl"
                alignItems="center"
              >
                <ActionSheet.ActionIcon type="Add" color="$tertiaryText" />
              </ListItem.EndContent>
            </ListItem>
          </Pressable>
        </ActionSheet.ActionGroup>
      </ScrollView>
      {!!editRole && (
        <EditRoleSheet
          role={editRole}
          rolesWithMembers={rolesWithMembers}
          channelsCurrentlyInUse={getChannelsForRole(editRole)}
          onEdit={handleEditRole}
          onDelete={handleDeleteRole}
          open={editRole !== null}
          onOpenChange={(open) => {
            if (!open) {
              setEditRole(null);
            }
          }}
          groupMembers={groupMembers}
          groupRoles={groupRoles}
          navigation={navigation}
          groupId={groupId}
        />
      )}
      <AddRoleSheet
        open={showAddRole}
        onOpenChange={setShowAddRole}
        onAdd={handleAddRole}
        groupMembers={groupMembers}
        groupRoles={groupRoles}
        navigation={navigation}
        groupId={groupId}
      />
    </View>
  );
}

type RoleFormData = {
  title: string;
  description: string;
};

function EditRoleSheet({
  role,
  onEdit,
  onDelete,
  open,
  onOpenChange,
  rolesWithMembers,
  channelsCurrentlyInUse,
  groupMembers,
  groupRoles,
  navigation,
  groupId,
}: {
  role: db.GroupRole;
  onEdit: (
    role: db.GroupRole,
    addMembers: string[],
    removeMembers: string[]
  ) => void;
  onDelete: (roleId: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rolesWithMembers: db.GroupRole[];
  channelsCurrentlyInUse: db.Channel[];
  groupMembers: db.ChatMember[];
  groupRoles: db.GroupRole[];
  navigation: Props['navigation'];
  groupId: string;
}) {
  const {
    reset,
    control,
    handleSubmit,
    formState: { errors, isValid },
    trigger,
  } = useForm<RoleFormData>({
    defaultValues: {
      title: role.title ?? undefined,
      description: role.description ?? undefined,
    },
  });

  const { bottom } = useSafeAreaInsets();

  // Get current members with this role
  const initialMembers = useMemo(() => {
    return groupMembers
      .filter((m) => m.roles?.some((r) => r.roleId === role.id))
      .map((m) => m.contactId);
  }, [groupMembers, role.id]);

  const [selectedMembers, setSelectedMembers] = useState<string[]>(initialMembers);

  const handleSave = useCallback(
    (data: { title: string; description: string }) => {
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
      onEdit(
        {
          ...role,
          title: data.title,
          description: data.description,
        },
        addMembers,
        removeMembers
      );
      reset();
      onOpenChange(false);
    },
    [onEdit, role, onOpenChange, reset, selectedMembers, initialMembers]
  );

  const disableDelete = useMemo(() => {
    return (
      (!!role.id && rolesWithMembers.some((r) => r.id === role.id)) ||
      channelsCurrentlyInUse.length > 0
    );
  }, [role.id, rolesWithMembers, channelsCurrentlyInUse]);

  const handleDelete = useCallback(() => {
    if (!role.id) {
      return;
    }
    if (role.title === 'Admin') {
      return;
    }
    onDelete(role.id);
    onOpenChange(false);
  }, [onDelete, role.id, role.title, onOpenChange]);

  const handleNavigateToMemberSelector = useCallback(() => {
    navigation.navigate('SelectRoleMembers', {
      groupId,
      roleId: role.id ?? undefined,
      selectedMembers,
      onSave: setSelectedMembers,
    });
  }, [navigation, groupId, role.id, selectedMembers]);

  return (
    <>
      <ActionSheet open={open} onOpenChange={onOpenChange} moveOnKeyboardChange>
        <ActionSheet.Content flex={1} paddingBottom={bottom}>
          <ActionSheet.SimpleHeader title="Edit role" />
          <YStack gap="$l" paddingHorizontal="$2xl" paddingBottom="$2xl">
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
                paddingHorizontal="$l"
                backgroundColor="$secondaryBackground"
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
                  <Button.Text>Delete role</Button.Text>
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
        </ActionSheet.Content>
      </ActionSheet>
    </>
  );
}

function AddRoleSheet({
  open,
  onOpenChange,
  onAdd,
  groupMembers,
  groupRoles,
  navigation,
  groupId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (data: { title: string; description: string; members: string[] }) => void;
  groupMembers: db.ChatMember[];
  groupRoles: db.GroupRole[];
  navigation: Props['navigation'];
  groupId: string;
}) {
  const {
    reset,
    control,
    handleSubmit,
    formState: { errors, isValid },
    trigger,
  } = useForm<RoleFormData>({
    defaultValues: {
      title: '',
      description: '',
    },
  });

  const { bottom } = useSafeAreaInsets();
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const handleSave = useCallback(
    (data: { title: string; description: string }) => {
      if (!data.title) {
        return;
      }
      onAdd({ ...data, members: selectedMembers });
      reset();
      setSelectedMembers([]);
      onOpenChange(false);
    },
    [onAdd, onOpenChange, reset, selectedMembers]
  );

  const handleNavigateToMemberSelector = useCallback(() => {
    navigation.navigate('SelectRoleMembers', {
      groupId,
      selectedMembers,
      onSave: setSelectedMembers,
    });
  }, [navigation, groupId, selectedMembers]);

  return (
    <>
      <ActionSheet open={open} onOpenChange={onOpenChange} moveOnKeyboardChange>
        <ActionSheet.Content flex={1} paddingBottom={bottom}>
          <ActionSheet.SimpleHeader title="Add role" />
          <YStack gap="$l" paddingHorizontal="$2xl" paddingBottom="$2xl">
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
                    testID="RoleDescriptionInput"
                  />
                </Field>
              )}
            />
            <Pressable onPress={handleNavigateToMemberSelector}>
              <ListItem
                paddingHorizontal="$l"
                backgroundColor="$secondaryBackground"
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
          </YStack>
        </ActionSheet.Content>
      </ActionSheet>
    </>
  );
}
