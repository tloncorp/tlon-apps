import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { ChannelPrivacyType } from '@tloncorp/shared/urbit/groups';
import _ from 'lodash';
import { useCallback, useEffect, useState } from 'react';
import { FormProvider, useForm, useFormContext } from 'react-hook-form';
import { Alert } from 'react-native';
import { View, XStack, YStack } from 'tamagui';

import { ActionSheet } from '../ActionSheet';
import { Button } from '../Button';
import { DeleteSheet } from '../DeleteSheet';
import { RadioInput } from '../Form';
import { FormInput } from '../FormInput';
import { ResponsiveSheet } from '../ResponsiveSheet';
import { ScreenHeader } from '../ScreenHeader';
import { Text } from '../TextV2';

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
              <YStack width="50%" gap="$2xl">
                <FormInput
                  control={control}
                  errors={errors}
                  name="title"
                  label="title"
                  placeholder="Channel title"
                  rules={{ required: 'Channel title is required' }}
                />
                <FormInput
                  control={control}
                  errors={errors}
                  name="description"
                  label="Description"
                  placeholder="Channel description"
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

  const readerRoles = options.filter(
    (o) => readers?.includes(o.value) || o.value === 'admin'
  );

  const writerRoles = options.filter(
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

      // Ensure readers include all writers
      const newWriterValues = roles.map((r) => r.value);
      setValue('writers', newWriterValues, { shouldDirty: true });
      setValue('readers', _.uniq([...readers, ...newWriterValues]), {
        shouldDirty: true,
      });
    },
    [setValue, readers]
  );

  const setReaders = useCallback(
    (roles: RoleOption[]) => {
      const newReaderValues = roles.map((r) => r.value);
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
          />
          <ChannelRoleSelector
            options={options}
            label="Writers"
            roles={writerRoles}
            setRoles={setWriters}
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
}: {
  options: RoleOption[];
  label: string;
  roles: RoleOption[];
  setRoles: (roles: RoleOption[]) => void;
}) {
  const trigger = (
    <XStack gap="$s">
      {roles.map((role) => (
        <Button
          size="$s"
          key={role.value}
          minimal
          backgroundColor="$background"
          borderRadius="$s"
        >
          <Button.Text fontSize="$xs">{role.label}</Button.Text>
        </Button>
      ))}
    </XStack>
  );

  return (
    <YStack gap="$m">
      <Text>{label}</Text>
      <XStack
        gap="$s"
        backgroundColor="$secondaryBackground"
        borderWidth={1}
        borderRadius="$m"
        borderColor="$border"
        padding="$s"
      >
        <ResponsiveSheet trigger={trigger} title={label}>
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
        </ResponsiveSheet>
      </XStack>
    </YStack>
  );
}
