import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { Button, FormInput, Icon, Pressable, Text } from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FormProvider, useForm, useFormContext } from 'react-hook-form';
import { Alert, Platform, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, View, XStack, YStack } from 'tamagui';

import { DeleteSheet } from '../DeleteSheet';
import { RadioControl } from '../Form';
import { ScreenHeader } from '../ScreenHeader';

interface ChannelFormSchema {
  title: string | null | undefined;
  description: string | null | undefined;
  isPrivate: boolean;
  readers: string[];
  writers: string[];
}

export interface RoleOption {
  label: string;
  value: string;
}

interface EditChannelScreenViewProps {
  goBack: () => void;
  isLoading: boolean;
  channel?: db.Channel | null;
  onSubmit: (
    title: string,
    readers: string[],
    writers: string[],
    description?: string
  ) => void;
  onDeleteChannel: () => void;
  createdRoleId?: string;
  onCreateRole: () => void;
}

const getDefaultFormValues = (
  channel?: db.Channel | null
): ChannelFormSchema => {
  const readerRoles = channel?.readerRoles?.map((r) => r.roleId) ?? [];
  const writerRoles = channel?.writerRoles?.map((r) => r.roleId) ?? [];
  const isPrivate = readerRoles.length > 0 || writerRoles.length > 0;

  const readers = isPrivate
    ? readerRoles.length === 0
      ? ['admin', MEMBERS_MARKER] // Empty readers means Members, but admin is always included
      : readerRoles.includes('admin')
        ? readerRoles
        : ['admin', ...readerRoles] // Ensure admin is present
    : [];

  const writers = isPrivate
    ? writerRoles.length === 0
      ? ['admin', MEMBERS_MARKER] // Empty writers means Members, but admin is always included
      : writerRoles.includes('admin')
        ? writerRoles
        : ['admin', ...writerRoles] // Ensure admin is present
    : [];

  return {
    title: channel?.title,
    description: channel?.description,
    readers,
    writers,
    isPrivate,
  };
};

export function EditChannelScreenView({
  goBack,
  isLoading,
  onSubmit,
  channel,
  onDeleteChannel,
  createdRoleId,
  onCreateRole,
}: EditChannelScreenViewProps) {
  const [showDeleteSheet, setShowDeleteSheet] = useState(false);
  const form = useForm<ChannelFormSchema>({
    defaultValues: getDefaultFormValues(channel),
    mode: 'onChange',
  });

  const {
    control,
    reset,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = form;

  useEffect(() => {
    if (createdRoleId) {
      const currentReaders = watch('readers');
      if (!currentReaders.includes(createdRoleId)) {
        setValue('readers', [...currentReaders, createdRoleId], {
          shouldDirty: true,
        });
      }
    }
  }, [createdRoleId, setValue, watch]);

  const { data: group } = store.useGroup({
    id: channel?.groupId ?? '',
  });

  const handleSave = useCallback(
    (data: ChannelFormSchema) => {
      const title = data.title;
      if (!title || typeof title !== 'string') {
        return;
      }

      // If MEMBERS_MARKER is present, send empty array (everyone can access)
      // Otherwise, ensure admin is included and send actual role IDs
      const readers = data.readers.includes(MEMBERS_MARKER)
        ? [] // Empty array means all members (including admin) can read
        : data.readers.filter((r) => r !== MEMBERS_MARKER); // Admin should already be in the array

      // Same for writers
      const writers = data.writers.includes(MEMBERS_MARKER)
        ? [] // Empty array means all members (including admin) can write
        : data.writers.filter((w) => w !== MEMBERS_MARKER); // Admin should already be in the array

      const formData = {
        ...data,
        title,
        description: data.description ?? undefined,
      };
      onSubmit(title, readers, writers, formData.description);
    },
    [onSubmit]
  );

  const handlePressDelete = useCallback(() => {
    const channelCount = group?.channels?.length ?? 0;
    if (channelCount <= 1) {
      Alert.alert(
        'Cannot Delete Channel',
        'A group must have at least one channel. Create another channel before deleting this one.',
        [{ text: 'OK' }]
      );
      return;
    }
    setShowDeleteSheet(true);
  }, [group?.channels?.length]);

  useEffect(() => {
    if (channel) {
      reset(getDefaultFormValues(channel));
    }
  }, [channel, reset]);

  const insets = useSafeAreaInsets();

  return (
    <FormProvider {...form}>
      <View backgroundColor="$background" flex={1}>
        <ScreenHeader
          title="Channel settings"
          backAction={goBack}
          isLoading={isLoading}
        />
        <ScrollView
          flex={1}
          contentContainerStyle={{ paddingBottom: insets.bottom }}
        >
          <YStack gap="$2xl" padding="$xl" alignItems="center">
            {isLoading || !channel ? null : (
              <YStack width="100%" gap="$2xl">
                <FormInput
                  control={control}
                  errors={errors}
                  name="title"
                  label="title"
                  placeholder="Channel title"
                  rules={{ required: 'Channel title is required' }}
                  testID="ChannelTitleInput"
                />
                <FormInput
                  control={control}
                  errors={errors}
                  name="description"
                  label="Description"
                  placeholder="Channel description"
                  testID="ChannelDescriptionInput"
                />
              </YStack>
            )}
            {!!group && !!channel && (
              <>
                <ChannelPermissionsSelector
                  groupRoles={group.roles}
                  onCreateRole={onCreateRole}
                />
                <PermissionTable groupRoles={group.roles} />
              </>
            )}
            <YStack gap="$2xl">
              <Button
                hero
                onPress={handleSubmit(handleSave)}
                testID="ChannelSettingsSaveButton"
              >
                <Button.Text>Save</Button.Text>
              </Button>
              <Button heroDestructive onPress={handlePressDelete}>
                <Button.Text>Delete channel for everyone</Button.Text>
              </Button>
            </YStack>
          </YStack>
        </ScrollView>
        <DeleteSheet
          open={showDeleteSheet}
          onOpenChange={(show) => setShowDeleteSheet(show)}
          title={channel?.title ?? 'channel'}
          itemTypeDescription="channel"
          deleteAction={onDeleteChannel}
        />
      </View>
    </FormProvider>
  );
}

const mapRoleIdsToOptions = (
  roleIds: string[],
  allRoles: RoleOption[]
): RoleOption[] =>
  roleIds.map((roleId) => {
    const role = allRoles.find((r) => r.value === roleId);
    return { label: role?.label ?? roleId, value: roleId };
  });

export const groupRolesToOptions = (groupRoles: db.GroupRole[]): RoleOption[] =>
  groupRoles.map((role) => ({
    label: role.title ?? 'Unknown role',
    value: role.id ?? '',
  }));

// Special marker for members without explicit roles
// In the backend, an empty readers/writers array means "accessible by all group members"
// We use null as a marker in the UI to represent this "Members" concept
export const MEMBERS_MARKER = null as unknown as string;

export const MEMBER_ROLE_OPTION: RoleOption = {
  label: 'Members',
  value: MEMBERS_MARKER,
};

export function PrivateChannelToggle({
  isPrivate,
  onTogglePrivate,
}: {
  isPrivate: boolean;
  onTogglePrivate: (value: boolean) => void;
}) {
  const handleToggle = useCallback(() => {
    onTogglePrivate(!isPrivate);
  }, [isPrivate, onTogglePrivate]);

  return (
    <XStack
      padding="$xl"
      justifyContent="space-between"
      alignItems="center"
      gap="$xl"
      backgroundColor="$secondaryBackground"
      width="100%"
      pointerEvents="auto"
    >
      <YStack gap="$xl" flex={1} pointerEvents="auto">
        <Text size="$label/l">Private Channel</Text>
        <Text size="$label/s" color="$tertiaryText">
          By making a channel private, only select members and roles will be
          able to view this channel.
        </Text>
      </YStack>
      {Platform.OS === 'android' ? (
        // Android-specific: Wrap Switch in Pressable to handle tap gestures before
        // they reach the Sheet's pan gesture handler. The Switch itself has
        // pointerEvents="none" to make it purely visual, while Pressable handles
        // all touch interaction. This fixes Switch tap detection issues in sheets
        // on physical Android devices.
        <Pressable
          onPress={handleToggle}
          testID="PrivateChannelTogglePressable"
        >
          <View pointerEvents="none">
            <Switch value={isPrivate} testID="PrivateChannelToggle" />
          </View>
        </Pressable>
      ) : (
        <Switch
          value={isPrivate}
          onValueChange={onTogglePrivate}
          testID="PrivateChannelToggle"
        />
      )}
    </XStack>
  );
}

export function ChannelPermissionsSelector({
  groupRoles,
  onCreateRole,
}: {
  groupRoles: db.GroupRole[];
  onCreateRole?: () => void;
}) {
  const { watch, setValue } = useFormContext<ChannelFormSchema>();
  const isPrivate = watch('isPrivate');
  const readers = watch('readers');
  const writers = watch('writers');

  const allRoles = useMemo(() => groupRolesToOptions(groupRoles), [groupRoles]);

  const handleTogglePrivate = useCallback(
    (value: boolean) => {
      setValue('isPrivate', value, { shouldDirty: true });
      const newRoles = value ? ['admin'] : [];
      setValue('readers', newRoles, { shouldDirty: true });
      setValue('writers', newRoles, { shouldDirty: true });
    },
    [setValue]
  );

  const handleRemoveRole = useCallback(
    (roleId: string) => {
      if (roleId === 'admin') return;
      setValue(
        'readers',
        readers.filter((r) => r !== roleId),
        {
          shouldDirty: true,
        }
      );
      setValue(
        'writers',
        writers.filter((w) => w !== roleId),
        {
          shouldDirty: true,
        }
      );
    },
    [readers, writers, setValue]
  );

  const displayedRoles = useMemo(() => {
    if (!isPrivate) return [];
    // Add Members option to the list of all roles for mapping
    const rolesWithMembers = [MEMBER_ROLE_OPTION, ...allRoles];
    const mappedRoles = mapRoleIdsToOptions(readers, rolesWithMembers);
    return mappedRoles.filter((role) => role.value !== 'admin');
  }, [isPrivate, readers, allRoles]);

  return (
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
  );
}

export function RoleChip({
  role,
  onRemove,
}: {
  role: RoleOption;
  onRemove?: () => void;
}) {
  return (
    <XStack
      backgroundColor="$positiveBackground"
      borderColor="$positiveBorder"
      borderRadius="$s"
      borderWidth={1}
      paddingHorizontal="$l"
      paddingVertical="$m"
      alignItems="center"
      gap="$s"
    >
      <Text fontSize="$s" color="$positiveActionText">
        {role.label}
      </Text>
      {onRemove && (
        <Pressable onPress={onRemove} testID={`RemoveRole-${role.label}`}>
          <Icon type="Close" size="$s" color="$positiveActionText" />
        </Pressable>
      )}
    </XStack>
  );
}

const checkboxColumnWidth = 100;

export function PermissionTable({
  groupRoles,
  onSelectRoles,
  onCreateRole,
  onRemoveRole,
}: {
  groupRoles: db.GroupRole[];
  onSelectRoles?: () => void;
  onCreateRole?: () => void;
  onRemoveRole?: (roleId: string) => void;
}) {
  const { watch, setValue } = useFormContext<ChannelFormSchema>();
  const isPrivate = watch('isPrivate');
  const readers = watch('readers');
  const writers = watch('writers');

  const displayedRoles = useMemo(() => {
    // Get all group roles that are in the readers list
    const regularRoles = groupRolesToOptions(groupRoles).filter((role) =>
      readers.includes(role.value)
    );

    // Always show Members option if it's in readers
    const hasMembersInReaders = readers.includes(MEMBERS_MARKER);

    // Build the final list: Members first (if present), then regular roles
    const roles = hasMembersInReaders
      ? [MEMBER_ROLE_OPTION, ...regularRoles]
      : regularRoles;

    return roles;
  }, [groupRoles, readers]);

  const handleToggleWriter = useCallback(
    (roleId: string) => {
      const isCurrentlyWriter = writers.includes(roleId);
      const isCurrentlyReader = readers.includes(roleId);

      if (isCurrentlyWriter) {
        // Remove from writers
        setValue(
          'writers',
          writers.filter((w) => w !== roleId),
          { shouldDirty: true }
        );
      } else {
        // Add to writers
        setValue('writers', [...writers, roleId], { shouldDirty: true });

        // For Members marker, also ensure it's in readers when enabling write
        if (roleId === MEMBERS_MARKER && !isCurrentlyReader) {
          setValue('readers', [...readers, roleId], { shouldDirty: true });
        }
      }
    },
    [writers, readers, setValue]
  );

  const handleToggleReader = useCallback(
    (roleId: string) => {
      // For Members marker, toggle it in/out of readers
      if (roleId === MEMBERS_MARKER) {
        const isCurrentlyReader = readers.includes(roleId);
        if (isCurrentlyReader) {
          // Remove from both readers and writers
          setValue(
            'readers',
            readers.filter((r) => r !== roleId),
            { shouldDirty: true }
          );
          setValue(
            'writers',
            writers.filter((w) => w !== roleId),
            { shouldDirty: true }
          );
        } else {
          // Add to readers
          setValue('readers', [...readers, roleId], { shouldDirty: true });
        }
      }
    },
    [readers, writers, setValue]
  );

  if (!isPrivate) return null;

  return (
    <YStack
      width="100%"
      borderColor="$secondaryBorder"
      borderWidth={1}
      borderRadius="$m"
      overflow="hidden"
    >
      <XStack
        width="100%"
        backgroundColor="$secondaryBackground"
        borderBottomColor="$secondaryBorder"
        borderBottomWidth={1}
        alignItems="center"
      >
        <Text size="$label/m" flex={1} paddingVertical="$xl" paddingLeft="$xl">
          Role
        </Text>
        <PermissionTableHeaderCell>Read</PermissionTableHeaderCell>
        <PermissionTableHeaderCell>Write</PermissionTableHeaderCell>
      </XStack>
      <YStack>
        {displayedRoles.map((role, index) => (
          <YStack
            // ternary on index doesn't work when optimized
            disableOptimization
            key={role.value}
            borderTopWidth={index === 0 ? 0 : 1}
            borderTopColor={'$secondaryBackground'}
          >
            <PermissionTableRow
              role={role}
              canRead={readers.includes(role.value)}
              canWrite={writers.includes(role.value)}
              onToggleRead={() => handleToggleReader(role.value)}
              onToggleWrite={() => handleToggleWriter(role.value)}
              onRemove={
                role.value !== 'admin' && onRemoveRole
                  ? () => onRemoveRole(role.value)
                  : undefined
              }
            />
          </YStack>
        ))}
        {/* Add roles and Create new role row */}
        {(onSelectRoles || onCreateRole) && (
          <XStack
            width="100%"
            alignItems="center"
            height={68}
            borderTopWidth={displayedRoles.length > 0 ? 1 : 0}
            borderTopColor="$secondaryBackground"
            paddingHorizontal="$xl"
            gap="$m"
          >
            {onSelectRoles && (
              <Button onPress={onSelectRoles}>
                <Button.Icon>
                  <Icon type="Add" />
                </Button.Icon>
                <Button.Text>Add roles</Button.Text>
              </Button>
            )}
            {onCreateRole && (
              <Button onPress={onCreateRole}>
                <Button.Icon>
                  <Icon type="Add" />
                </Button.Icon>
                <Button.Text>Create new role</Button.Text>
              </Button>
            )}
          </XStack>
        )}
      </YStack>
    </YStack>
  );
}

function PermissionTableHeaderCell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <XStack
      width={checkboxColumnWidth}
      alignItems="center"
      justifyContent="center"
      borderLeftWidth={1}
      borderLeftColor="$secondaryBorder"
    >
      <Text size="$label/m" textAlign="center" paddingVertical="$xl">
        {children}
      </Text>
    </XStack>
  );
}

function PermissionTableRow({
  role,
  canRead,
  canWrite,
  onToggleRead,
  onToggleWrite,
  onRemove,
}: {
  role: RoleOption;
  canRead: boolean;
  canWrite: boolean;
  onToggleRead: () => void;
  onToggleWrite: () => void;
  onRemove?: () => void;
}) {
  const isAdmin = role.value === 'admin';
  const isMember = role.value === MEMBERS_MARKER;

  return (
    <XStack width="100%" alignItems="stretch" flex={1} height={68}>
      <YStack flex={1} justifyContent="center">
        <XStack alignItems="center" gap="$m" paddingHorizontal="$xl">
          <Text size="$label/m" paddingVertical="$m" flex={1}>
            {role.label}
          </Text>
          {onRemove && (
            <Pressable onPress={onRemove} testID={`RemoveRole-${role.label}`}>
              <Icon type="Close" size="$s" color="$tertiaryText" />
            </Pressable>
          )}
        </XStack>
      </YStack>
      <PermissionTableControlCell>
        {isMember ? (
          <Pressable onPress={onToggleRead} testID={`ReadToggle-${role.label}`}>
            <RadioControl checked={canRead} />
          </Pressable>
        ) : (
          <RadioControl checked disabled testID={`ReadToggle-${role.label}`} />
        )}
      </PermissionTableControlCell>
      <PermissionTableControlCell>
        {isAdmin ? (
          <RadioControl
            checked={canWrite}
            disabled
            testID={`WriteToggle-${role.label}`}
          />
        ) : (
          <Pressable
            onPress={onToggleWrite}
            testID={`WriteToggle-${role.label}`}
          >
            <RadioControl checked={canWrite} />
          </Pressable>
        )}
      </PermissionTableControlCell>
    </XStack>
  );
}

function PermissionTableControlCell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <XStack
      width={checkboxColumnWidth}
      justifyContent="center"
      alignItems="center"
      borderLeftWidth={1}
      borderLeftColor="$secondaryBackground"
      paddingVertical="$m"
    >
      {children}
    </XStack>
  );
}
