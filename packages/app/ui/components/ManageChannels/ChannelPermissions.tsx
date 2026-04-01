import * as db from '@tloncorp/shared/db';
import { Icon, IconButton, Pressable, Text } from '@tloncorp/ui';
import { useCallback, useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import { Platform, Switch } from 'react-native';
import { View, XStack, YStack } from 'tamagui';

import { RadioControl } from '../Form';
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
    // Use the union of readers and writers so writer-only roles remain visible
    const allRelevantIds = [...new Set([...readers, ...writers])];
    const regularRoles = groupRolesToOptions(groupRoles).filter((role) =>
      allRelevantIds.includes(role.value)
    );

    const hasMembersInRelevant = allRelevantIds.includes(MEMBERS_MARKER);

    const roles = hasMembersInRelevant
      ? [...regularRoles, MEMBER_ROLE_OPTION]
      : regularRoles;

    return roles;
  }, [groupRoles, readers, writers]);

  const handleToggleWriter = useCallback(
    (roleId: string) => {
      const isCurrentlyWriter = writers.includes(roleId);
      const isCurrentlyReader = readers.includes(roleId);

      if (isCurrentlyWriter) {
        // Remove from writers; add to readers if not already there so the role
        // stays visible as read-only instead of vanishing
        setValue(
          'writers',
          writers.filter((w) => w !== roleId),
          { shouldDirty: true }
        );
        if (!isCurrentlyReader) {
          setValue('readers', [...readers, roleId], { shouldDirty: true });
        }
      } else {
        // Add to writers; write implies read
        setValue('writers', [...writers, roleId], { shouldDirty: true });
        if (!isCurrentlyReader) {
          setValue('readers', [...readers, roleId], { shouldDirty: true });
        }
      }
    },
    [writers, readers, setValue]
  );

  const handleToggleReader = useCallback(
    (roleId: string) => {
      const isCurrentlyReader = readers.includes(roleId);
      if (isCurrentlyReader) {
        // Remove from both readers and writers (no read implies no write)
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
