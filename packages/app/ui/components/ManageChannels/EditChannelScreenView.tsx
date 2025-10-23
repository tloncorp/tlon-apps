import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { Button, FormInput, Icon, Pressable, Text } from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FormProvider, useForm, useFormContext } from 'react-hook-form';
import { Alert, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, View, XStack, YStack } from 'tamagui';

import { ActionSheet } from '../ActionSheet';
import { DeleteSheet } from '../DeleteSheet';
import { RadioControl, TextInput } from '../Form';
import { ListItem } from '../ListItem';
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
}

const getDefaultFormValues = (
  channel?: db.Channel | null
): ChannelFormSchema => ({
  title: channel?.title,
  description: channel?.description,
  readers: channel?.readerRoles?.map((r) => r.roleId) ?? [],
  writers: channel?.writerRoles?.map((r) => r.roleId) ?? [],
  isPrivate:
    (channel?.writerRoles?.length ?? 0) > 0 ||
    (channel?.readerRoles?.length ?? 0) > 0,
});

export function EditChannelScreenView({
  goBack,
  isLoading,
  onSubmit,
  channel,
  onDeleteChannel,
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
  } = form;

  const { data: group } = store.useGroup({
    id: channel?.groupId ?? '',
  });

  const handleSave = useCallback(
    (data: ChannelFormSchema) => {
      const title = data.title;
      if (!title || typeof title !== 'string') {
        return;
      }
      const formData = {
        ...data,
        title,
        description: data.description ?? undefined,
      };
      onSubmit(title, formData.readers, formData.writers, formData.description);
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
                <ChannelPermissionsSelector groupRoles={group.roles} />
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

export function PrivateChannelToggle({
  isPrivate,
  onTogglePrivate,
}: {
  isPrivate: boolean;
  onTogglePrivate: (value: boolean) => void;
}) {
  return (
    <XStack
      padding="$xl"
      justifyContent="space-between"
      alignItems="center"
      gap="$xl"
      backgroundColor="$secondaryBackground"
      width="100%"
    >
      <YStack gap="$xl" flex={1}>
        <Text size="$label/l">Private Channel</Text>
        <Text size="$label/s" color="$tertiaryText">
          By making a channel private, only select members and roles will be
          able to view this channel.
        </Text>
      </YStack>
      <Switch
        value={isPrivate}
        onValueChange={onTogglePrivate}
        testID="PrivateChannelToggle"
      />
    </XStack>
  );
}

export function ChannelPermissionsSelector({
  groupRoles,
}: {
  groupRoles: db.GroupRole[];
}) {
  const { watch, setValue } = useFormContext<ChannelFormSchema>();
  const isPrivate = watch('isPrivate');
  const readers = watch('readers');
  const writers = watch('writers');
  const [showRoleSelector, setShowRoleSelector] = useState(false);

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

  const displayedRoles = useMemo(
    () => (isPrivate ? mapRoleIdsToOptions(readers, allRoles) : []),
    [isPrivate, readers, allRoles]
  );

  const handleSaveRoles = useCallback(
    (roleIds: string[]) => {
      setValue('readers', roleIds, { shouldDirty: true });
    },
    [setValue]
  );

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

      {isPrivate && (
        <YStack
          padding="$xl"
          gap="$2xl"
          width="100%"
          borderTopWidth={1}
          borderTopColor="$secondaryBorder"
        >
          <XStack>
            <Text size="$label/l" flex={1}>
              Who can access this channel?
            </Text>
            <XStack flex={1.5} justifyContent="flex-end">
              <Button
                width={120}
                onPress={() => setShowRoleSelector(true)}
                size={'$l'}
                backgroundColor="$positiveActionText"
                pressStyle={{
                  backgroundColor: '$positiveActionText',
                  opacity: 0.9,
                }}
                borderColor="$positiveActionText"
              >
                <Button.Text color="$positiveBackground">Add roles</Button.Text>
              </Button>
            </XStack>
          </XStack>
          <YStack gap="$l">
            <Text size="$label/l">Roles</Text>
            <XStack gap="$s" flexWrap="wrap" width="100%">
              {displayedRoles.map((role) => (
                <RoleChip
                  key={role.value}
                  role={role}
                  onRemove={
                    role.value !== 'admin'
                      ? () => handleRemoveRole(role.value)
                      : undefined
                  }
                />
              ))}
            </XStack>
          </YStack>
        </YStack>
      )}

      <RoleSelectionSheet
        open={showRoleSelector}
        onOpenChange={setShowRoleSelector}
        allRoles={allRoles}
        selectedRoleIds={readers}
        onSave={handleSaveRoles}
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
}: {
  groupRoles: db.GroupRole[];
}) {
  const { watch, setValue } = useFormContext<ChannelFormSchema>();
  const isPrivate = watch('isPrivate');
  const readers = watch('readers');
  const writers = watch('writers');

  const displayedRoles = useMemo(
    () =>
      groupRolesToOptions(groupRoles).filter((role) =>
        readers.includes(role.value)
      ),
    [groupRoles, readers]
  );

  const handleToggleWriter = useCallback(
    (roleId: string) => {
      const isCurrentlyWriter = writers.includes(roleId);
      setValue(
        'writers',
        isCurrentlyWriter
          ? writers.filter((w) => w !== roleId)
          : [...writers, roleId],
        { shouldDirty: true }
      );
    },
    [writers, setValue]
  );

  if (!isPrivate || displayedRoles.length === 0) return null;

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
              canWrite={writers.includes(role.value)}
              onToggleWrite={() => handleToggleWriter(role.value)}
            />
          </YStack>
        ))}
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
  canWrite,
  onToggleWrite,
}: {
  role: RoleOption;
  canWrite: boolean;
  onToggleWrite: () => void;
}) {
  const isAdmin = role.value === 'admin';

  return (
    <XStack width="100%" alignItems="stretch" flex={1} height={68}>
      <YStack flex={1} justifyContent="center">
        <Text size="$label/m" paddingVertical="$m" paddingHorizontal={'$xl'}>
          {role.label}
        </Text>
      </YStack>
      <PermissionTableControlCell>
        <RadioControl checked disabled testID={`ReadToggle-${role.label}`} />
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

export function RoleSelectionSheet({
  open,
  onOpenChange,
  allRoles,
  selectedRoleIds,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allRoles: RoleOption[];
  selectedRoleIds: string[];
  onSave: (roleIds: string[]) => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [tempSelectedRoleIds, setTempSelectedRoleIds] =
    useState<string[]>(selectedRoleIds);
  const [isScrolling, setIsScrolling] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (open) {
      setTempSelectedRoleIds(selectedRoleIds);
      setSearchQuery('');
      setIsScrolling(false);
    } else {
      setIsScrolling(false);
    }
  }, [open, selectedRoleIds]);

  const filteredRoles = useMemo(() => {
    const nonAdminRoles = allRoles.filter((role) => role.value !== 'admin');
    if (!searchQuery.trim()) {
      return nonAdminRoles;
    }
    const query = searchQuery.toLowerCase();
    return nonAdminRoles.filter((role) =>
      role.label.toLowerCase().includes(query)
    );
  }, [allRoles, searchQuery]);

  const handleToggleRole = useCallback((roleId: string) => {
    setTempSelectedRoleIds((prev) => {
      if (prev.includes(roleId)) {
        return prev.filter((id) => id !== roleId);
      }
      return [...prev, roleId];
    });
  }, []);

  const handleSave = useCallback(() => {
    onSave(tempSelectedRoleIds);
    onOpenChange(false);
  }, [tempSelectedRoleIds, onSave, onOpenChange]);

  return (
    <ActionSheet
      open={open}
      onOpenChange={onOpenChange}
      snapPoints={[85]}
      snapPointsMode="percent"
      disableDrag={isScrolling}
    >
      <ActionSheet.SimpleHeader
        title="Search and add roles"
        subtitle="Select roles for this channel"
      />
      <ActionSheet.Content
        paddingHorizontal="$l"
        paddingTop="$xl"
        paddingBottom={0}
      >
        <TextInput
          icon="Search"
          placeholder="Search roles"
          value={searchQuery}
          onChangeText={setSearchQuery}
          testID="RoleSearchInput"
        />
      </ActionSheet.Content>
      <ActionSheet.ScrollableContent
        paddingHorizontal="$l"
        onScrollBeginDrag={() => setIsScrolling(true)}
        onScrollEndDrag={() => setIsScrolling(false)}
      >
        <YStack gap="$m" paddingTop="$m">
          {filteredRoles.map((role) => (
            <SelectableRoleListItem
              key={role.value}
              role={role}
              isSelected={tempSelectedRoleIds.includes(role.value)}
              onPress={() => handleToggleRole(role.value)}
            />
          ))}
          {filteredRoles.length === 0 && (
            <View paddingVertical="$2xl" alignItems="center">
              <Text color="$tertiaryText">No roles found</Text>
            </View>
          )}
        </YStack>
      </ActionSheet.ScrollableContent>
      <ActionSheet.Content
        paddingHorizontal="$l"
        paddingTop="$m"
        paddingBottom={insets.bottom}
        backgroundColor="$background"
        borderTopWidth={1}
        borderTopColor="$border"
      >
        <Button hero onPress={handleSave} testID="RoleSelectionSaveButton">
          <Button.Text>Save</Button.Text>
        </Button>
      </ActionSheet.Content>
    </ActionSheet>
  );
}

function SelectableRoleListItem({
  role,
  isSelected,
  onPress,
}: {
  role: RoleOption;
  isSelected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPressIn={onPress}>
      <ListItem
        {...(isSelected
          ? { backgroundColor: '$secondaryBackground' }
          : { borderColor: '$secondaryBorder', borderWidth: 1 })}
        borderRadius="$xl"
        height={130}
        paddingLeft="$3xl"
        paddingRight="$2xl"
        alignItems="center"
      >
        <ListItem.MainContent alignItems="center" justifyContent="center">
          <XStack
            justifyContent="space-between"
            alignItems="center"
            width="100%"
          >
            <ListItem.Title>{role.label}</ListItem.Title>
            <RadioControl checked={isSelected} />
          </XStack>
        </ListItem.MainContent>
      </ListItem>
    </Pressable>
  );
}
