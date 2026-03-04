import * as db from '@tloncorp/shared/db';
import { Button, Icon, IconButton, Pressable, Text } from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Platform, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, XStack, YStack } from 'tamagui';

import { ActionSheet } from '../ActionSheet';
import { RadioControl, TextInput } from '../Form';
import { ListItem } from '../ListItem';
import {
  ChannelPrivacyFormSchema,
  MEMBERS_MARKER,
  MEMBER_ROLE_OPTION,
  RoleOption,
  groupRolesToOptions,
} from './channelFormUtils';

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
        <Text size="$label/l">Custom Permissions</Text>
        <Text size="$label/s" color="$tertiaryText">
          Only selected roles will be able to view or write to this channel.
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

const checkboxColumnWidth = 75;
const actionsColumnWidth = 75;

export function PermissionTable({
  groupRoles,
}: {
  groupRoles: db.GroupRole[];
}) {
  const { watch, setValue } = useFormContext<ChannelPrivacyFormSchema>();
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

  const handleDeleteRole = useCallback(
    (roleId: string) => {
      if (roleId === 'admin') return;
      setValue(
        'readers',
        readers.filter((readerId) => readerId !== roleId),
        { shouldDirty: true }
      );
      setValue(
        'writers',
        writers.filter((writerId) => writerId !== roleId),
        { shouldDirty: true }
      );
    },
    [readers, writers, setValue]
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
        <PermissionTableHeaderCell width={actionsColumnWidth}>
          Remove
        </PermissionTableHeaderCell>
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
              onDeleteRole={() => handleDeleteRole(role.value)}
            />
          </YStack>
        ))}
      </YStack>
    </YStack>
  );
}

function PermissionTableHeaderCell({
  children,
  width = checkboxColumnWidth,
}: {
  children: React.ReactNode;
  width?: number;
}) {
  return (
    <XStack
      width={width}
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
  onDeleteRole,
}: {
  role: RoleOption;
  canRead: boolean;
  canWrite: boolean;
  onToggleRead: () => void;
  onToggleWrite: () => void;
  onDeleteRole: () => void;
}) {
  const isAdmin = role.value === 'admin';
  const isMember = role.value === MEMBERS_MARKER;

  return (
    <XStack width="100%" alignItems="stretch" flex={1} height={68}>
      <YStack flex={1} justifyContent="center">
        <Text size="$label/m" paddingVertical="$m" paddingHorizontal={'$xl'}>
          {role.label}
        </Text>
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
      <PermissionTableControlCell width={actionsColumnWidth}>
        {role.value !== 'admin' ? (
          <IconButton
            onPress={onDeleteRole}
            testID={`RemoveRole-${role.label}`}
          >
            <Icon type="Close" size="$m" />
          </IconButton>
        ) : null}
      </PermissionTableControlCell>
    </XStack>
  );
}

function PermissionTableControlCell({
  children,
  width = checkboxColumnWidth,
}: {
  children: React.ReactNode;
  width?: number;
}) {
  return (
    <XStack
      width={width}
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
    const rolesWithMembers = [MEMBER_ROLE_OPTION, ...nonAdminRoles];
    if (!searchQuery.trim()) {
      return rolesWithMembers;
    }
    const query = searchQuery.toLowerCase();
    return rolesWithMembers.filter((role) =>
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
      modal
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
        <YStack gap="$m" paddingTop="$m" paddingHorizontal="$l">
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
        <View
          paddingHorizontal="$l"
          paddingTop="$m"
          paddingBottom={insets.bottom}
          backgroundColor="$background"
          borderTopWidth={1}
          borderTopColor="$border"
        >
          <Button
            preset="hero"
            label="Save"
            onPress={handleSave}
            testID="RoleSelectionSaveButton"
          />
        </View>
      </ActionSheet.ScrollableContent>
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
    <Pressable onPress={onPress}>
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
