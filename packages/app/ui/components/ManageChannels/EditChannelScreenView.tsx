import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { ChannelPrivacyType } from '@tloncorp/shared/urbit/groups';
import { Button } from '@tloncorp/ui';
import { FormInput } from '@tloncorp/ui';
import { Pressable } from '@tloncorp/ui';
import { Text } from '@tloncorp/ui';
import _ from 'lodash';
import { useCallback, useEffect, useState } from 'react';
import { FormProvider, useForm, useFormContext } from 'react-hook-form';
import { Alert } from 'react-native';
import { View, XStack, YStack } from 'tamagui';

import { ActionSheet } from '../ActionSheet';
import { DeleteSheet } from '../DeleteSheet';
import { RadioInput } from '../Form';
import { ScreenHeader } from '../ScreenHeader';

interface ChannelPrivacySetting {
  title: string;
  description: string;
}

interface ChannelFormSchema {
  title: string | null | undefined;
  description: string | null | undefined;
  privacy: ChannelPrivacyType;
  readers: string[];
  writers: string[];
}

export const PRIVACY_TYPE: Record<ChannelPrivacyType, ChannelPrivacySetting> = {
  public: {
    title: 'Open to All Members',
    description: 'Everyone can read and write',
  },
  custom: {
    title: 'Custom',
    description: 'Specify which roles can read and write',
  },
};

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

export function EditChannelScreenView({
  goBack,
  isLoading,
  onSubmit,
  channel,
  onDeleteChannel,
}: EditChannelScreenViewProps) {
  const [showDeleteSheet, setShowDeleteSheet] = useState(false);
  const form = useForm<ChannelFormSchema>({
    defaultValues: {
      title: channel?.title,
      description: channel?.description,
      readers: channel?.readerRoles?.map((r) => r.roleId) ?? [],
      writers: channel?.writerRoles?.map((r) => r.roleId) ?? [],
      privacy:
        (channel?.writerRoles?.length ?? 0) > 0 ||
        (channel?.readerRoles?.length ?? 0) > 0
          ? ('custom' as ChannelPrivacyType)
          : ('public' as ChannelPrivacyType),
    },
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
      console.log('Saving form data:', formData);
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
      reset({
        title: channel.title,
        description: channel.description,
        readers: channel.readerRoles?.map((r) => r.roleId) ?? [],
        writers: channel.writerRoles?.map((r) => r.roleId) ?? [],
        privacy:
          (channel.writerRoles?.length ?? 0) > 0 ||
          (channel.readerRoles?.length ?? 0) > 0
            ? ('custom' as ChannelPrivacyType)
            : ('public' as ChannelPrivacyType),
      });
    }
  }, [channel, reset]);

  return (
    <FormProvider {...form}>
      <View backgroundColor="$background" flex={1}>
        <YStack
          backgroundColor="$background"
          justifyContent="space-between"
          flex={1}
        >
          <ScreenHeader
            title="Edit channel"
            backAction={goBack}
            isLoading={isLoading}
          />
          <YStack
            backgroundColor="$background"
            gap="$2xl"
            padding="$xl"
            alignItems="center"
            flex={1}
          >
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
              <ChannelPermissionsSelector groupRoles={group.roles} />
            )}
            <YStack gap="$2xl">
              <Button hero onPress={handleSubmit(handleSave)}>
                <Button.Text>Save</Button.Text>
              </Button>
              <Button heroDestructive onPress={handlePressDelete}>
                <Button.Text>Delete channel for everyone</Button.Text>
              </Button>
            </YStack>
            <DeleteSheet
              open={showDeleteSheet}
              onOpenChange={(show) => setShowDeleteSheet(show)}
              title={channel?.title ?? 'channel'}
              itemTypeDescription="channel"
              deleteAction={onDeleteChannel}
            />
          </YStack>
        </YStack>
      </View>
    </FormProvider>
  );
}

export function ChannelPermissionsSelector({
  groupRoles,
}: {
  groupRoles: db.GroupRole[];
}) {
  const { watch, setValue, getValues } = useFormContext<ChannelFormSchema>();
  const custom = watch('privacy') === 'custom';
  const readers = watch('readers');
  const writers = watch('writers');

  const options = groupRoles
    .map((role) => ({
      label: role.title ?? 'Unknown role',
      value: role.id ?? '',
    }))
    .concat({
      label: 'Members',
      value: 'members',
    });

  const readerRoles =
    readers?.length === 0
      ? options
      : options.filter(
          (o) => readers?.includes(o.value) || o.value === 'admin'
        );

  const writerRoles =
    writers?.length === 0
      ? options
      : options.filter(
          (o) => writers?.includes(o.value) || o.value === 'admin'
        );

  const handleSelectPrivacyType = useCallback(
    (type: ChannelPrivacyType) => {
      setValue('privacy', type, { shouldDirty: true });

      if (type === 'public') {
        // Clear all roles for public channels
        setValue('readers', [], { shouldDirty: true });
        setValue('writers', [], { shouldDirty: true });
      } else if (
        !getValues('readers')?.length &&
        !getValues('writers')?.length
      ) {
        // For custom with no roles, initialize with admin
        const adminRole = options.find((o) => o.value === 'admin');
        if (adminRole) {
          setValue('readers', [adminRole.value], { shouldDirty: true });
          setValue('writers', [adminRole.value], { shouldDirty: true });
        }
      }
    },
    [setValue, getValues, options]
  );

  const setWriters = useCallback(
    (roles: RoleOption[]) => {
      if (roles.some((r) => r.value === 'members')) {
        setValue('privacy', 'public' as ChannelPrivacyType, {
          shouldDirty: true,
        });
        setValue('readers', [], { shouldDirty: true });
        setValue('writers', [], { shouldDirty: true });
        return;
      }

      const newWriterValues = roles.map((r) => r.value);

      // check if newWriterValues includes admin
      if (!newWriterValues.includes('admin')) {
        // add admin to newWriterValues if it's not already there
        newWriterValues.push('admin');
      }

      setValue('writers', newWriterValues, { shouldDirty: true });

      // If readers is empty, keep it empty (meaning everyone has read access)
      // Otherwise ensure readers include all writers
      if (readers.length > 0) {
        setValue('readers', _.uniq([...readers, ...newWriterValues]), {
          shouldDirty: true,
        });
      }
    },
    [setValue, readers]
  );

  const setReaders = useCallback(
    (roles: RoleOption[]) => {
      if (roles.some((r) => r.value === 'members')) {
        setValue('readers', [], { shouldDirty: true });
        return;
      }

      const newReaderValues = roles.map((r) => r.value);

      // check if newReaderValues includes admin
      if (!newReaderValues.includes('admin')) {
        // add admin to newReaderValues if it's not already there
        newReaderValues.push('admin');
      }

      setValue('readers', newReaderValues, { shouldDirty: true });

      // Remove writers that are no longer readers
      setValue(
        'writers',
        writers.filter((w) => newReaderValues.includes(w)),
        { shouldDirty: true }
      );
    },
    [setValue, writers]
  );

  return (
    <YStack gap="$2xl">
      <RadioInput
        options={Object.entries(PRIVACY_TYPE).map(([type, settings]) => ({
          title: settings.title,
          value: type,
          description: settings.description,
        }))}
        value={
          custom
            ? ('custom' as ChannelPrivacyType)
            : ('public' as ChannelPrivacyType)
        }
        onChange={(type) => handleSelectPrivacyType(type as ChannelPrivacyType)}
      />
      {custom && (
        <YStack gap="$m">
          <ChannelRoleSelector
            options={options}
            label="Readers"
            roles={readerRoles}
            setRoles={setReaders}
            testID="ReaderRoleSelector"
          />
          <ChannelRoleSelector
            options={options}
            label="Writers"
            roles={writerRoles}
            setRoles={setWriters}
            testID="WriterRoleSelector"
          />
        </YStack>
      )}
    </YStack>
  );
}

interface RoleOption {
  value: string;
  label: string;
}

export function ChannelRoleSelector({
  options,
  label,
  roles,
  setRoles,
  testID,
}: {
  options: RoleOption[];
  label: string;
  roles: RoleOption[];
  setRoles: (roles: RoleOption[]) => void;
  testID?: string;
}) {
  const [open, setOpen] = useState(false);
  const trigger = (
    <XStack gap="$s">
      {roles.map((role) => (
        <Button
          size="$s"
          key={role.value}
          minimal
          backgroundColor="$background"
          borderRadius="$s"
          onPress={() => setOpen(true)}
        >
          <Button.Text fontSize="$xs">{role.label}</Button.Text>
        </Button>
      ))}
    </XStack>
  );

  return (
    <YStack gap="$m">
      <Text>{label}</Text>
      <Pressable onPress={() => setOpen(true)} testID={testID}>
        <XStack
          gap="$s"
          backgroundColor="$secondaryBackground"
          borderWidth={1}
          borderRadius="$m"
          borderColor="$border"
          padding="$s"
        >
          <ActionSheet
            trigger={trigger}
            title={label}
            open={open}
            onOpenChange={setOpen}
            mode="popover"
          >
            <ActionSheet.ActionGroup padding={1}>
              {options.map((option) => (
                <ActionSheet.Action
                  key={option.value}
                  action={{
                    title: option.label,
                    action: () => {
                      const newRoles = () => {
                        if (roles.some((r) => r.value === option.value)) {
                          return roles.filter((r) => r.value !== option.value);
                        }
                        return roles.concat({
                          value: option.value,
                          label: option.label,
                        });
                      };

                      setRoles(newRoles());
                    },
                    endIcon: roles.map((r) => r.value).includes(option.value)
                      ? 'Checkmark'
                      : undefined,
                  }}
                />
              ))}
            </ActionSheet.ActionGroup>
          </ActionSheet>
        </XStack>
      </Pressable>
    </YStack>
  );
}
