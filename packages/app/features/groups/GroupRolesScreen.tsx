import { useRoute } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/db';
import {
  ActionSheet,
  Button,
  Field,
  ListItem,
  Pressable,
  ScreenHeader,
  ScrollView,
  TextInput,
  View,
  YStack,
} from '@tloncorp/ui';
import { useCallback, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useGroupContext } from '../../hooks/useGroupContext';
import {
  GroupSettingsStackParamList,
  GroupSettingsStackRouteProp,
} from '../../navigation/types';
import { useRootNavigation } from '../../navigation/utils';

type Props = NativeStackScreenProps<GroupSettingsStackParamList, 'GroupRoles'>;

export function GroupRolesScreen(props: Props) {
  return <GroupRolesScreenView />;
}

function GroupRolesScreenView() {
  const {
    params: { groupId },
  } = useRoute<GroupSettingsStackRouteProp<'GroupRoles'>>();
  const [editRole, setEditRole] = useState<db.GroupRole | null>(null);
  const [showAddRole, setShowAddRole] = useState(false);

  const { navigateBack } = useRootNavigation();
  const insets = useSafeAreaInsets();

  const { groupRoles, updateGroupRole, deleteGroupRole, createGroupRole } =
    useGroupContext({
      groupId,
    });

  const handleSetEditRole = useCallback((role: db.GroupRole) => {
    setEditRole(role);
  }, []);

  const handleAddRole = useCallback(
    ({ title, description }: { title: string; description: string }) => {
      createGroupRole({
        id: title.toLowerCase().replace(/\s/g, '-'),
        title,
        description,
      });
    },
    [createGroupRole]
  );

  const handleEditRole = useCallback(
    (role: db.GroupRole) => {
      updateGroupRole(role);
    },
    [updateGroupRole]
  );

  const handleDeleteRole = useCallback(
    (roleId: string) => {
      deleteGroupRole(roleId);
    },
    [deleteGroupRole]
  );

  return (
    <View flex={1} backgroundColor="$secondaryBackground">
      <ScreenHeader backAction={navigateBack} title={'Group Roles'} />
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
                key={role.id}
                paddingHorizontal="$2xl"
                backgroundColor={'$background'}
                borderRadius="$2xl"
              >
                <ActionSheet.MainContent>
                  <ActionSheet.ActionTitle>
                    {role.title}
                  </ActionSheet.ActionTitle>
                  <ListItem.Subtitle>{role.description}</ListItem.Subtitle>
                </ActionSheet.MainContent>

                <ListItem.EndContent
                  flexDirection="row"
                  gap="$xl"
                  alignItems="center"
                >
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
              <ActionSheet.MainContent>
                <ActionSheet.ActionTitle>Add role</ActionSheet.ActionTitle>
              </ActionSheet.MainContent>
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
          onEdit={handleEditRole}
          onDelete={handleDeleteRole}
          open={editRole !== null}
          onOpenChange={(open) => {
            if (!open) {
              setEditRole(null);
            }
          }}
        />
      )}
      <AddRoleSheet
        open={showAddRole}
        onOpenChange={setShowAddRole}
        onAdd={handleAddRole}
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
}: {
  role: db.GroupRole;
  onEdit: (role: db.GroupRole) => void;
  onDelete: (roleId: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

  const handleSave = useCallback(
    (data: { title: string; description: string }) => {
      if (!role) {
        return;
      }
      onEdit({
        ...role,
        title: data.title,
        description: data.description,
      });
      reset();
      onOpenChange(false);
    },
    [onEdit, role, onOpenChange, reset]
  );

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

  return (
    <ActionSheet
      open={open}
      onOpenChange={onOpenChange}
      snapPoints={[45]}
      snapPointsMode="percent"
    >
      <ActionSheet.Content flex={1} paddingBottom={bottom}>
        <ActionSheet.SimpleHeader title="Edit role" />
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
                  }}
                  value={value}
                  editable={role.title !== 'Admin'}
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
                  onBlur={onBlur}
                  value={value}
                  editable={role.title !== 'Admin'}
                />
              </Field>
            )}
          />
          <Button hero onPress={handleSubmit(handleSave)} disabled={!isValid}>
            <Button.Text>Save</Button.Text>
          </Button>
          {role.title === 'Admin' ? null : (
            <Button heroDestructive onPress={handleDelete}>
              <Button.Text>Delete role</Button.Text>
            </Button>
          )}
        </YStack>
      </ActionSheet.Content>
    </ActionSheet>
  );
}

function AddRoleSheet({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (data: { title: string; description: string }) => void;
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

  const handleSave = useCallback(
    (data: { title: string; description: string }) => {
      if (!data.title) {
        return;
      }
      onAdd(data);
      reset();
      onOpenChange(false);
    },
    [onAdd, onOpenChange, reset]
  );

  return (
    <ActionSheet
      open={open}
      onOpenChange={onOpenChange}
      snapPoints={[45]}
      snapPointsMode="percent"
    >
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
                  }}
                  value={value}
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
                  onBlur={onBlur}
                  value={value}
                />
              </Field>
            )}
          />
          <Button hero onPress={handleSubmit(handleSave)} disabled={!isValid}>
            <Button.Text>Save</Button.Text>
          </Button>
        </YStack>
      </ActionSheet.Content>
    </ActionSheet>
  );
}
