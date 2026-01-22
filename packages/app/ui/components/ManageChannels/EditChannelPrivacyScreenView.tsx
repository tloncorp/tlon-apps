import * as db from '@tloncorp/shared/db';
import { Button } from '@tloncorp/ui';
import { useCallback, useEffect, useMemo } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, View, YStack } from 'tamagui';

import { ScreenHeader } from '../ScreenHeader';
import {
  ChannelPermissionsSelector,
  MEMBERS_MARKER,
  PermissionTable,
} from './EditChannelScreenView';

interface ChannelPrivacyFormSchema {
  isPrivate: boolean;
  readers: string[];
  writers: string[];
}

interface EditChannelPrivacyScreenViewProps {
  goBack: () => void;
  isLoading: boolean;
  channel?: db.Channel | null;
  group?: db.Group | null;
  onSubmit: (readers: string[], writers: string[]) => void;
}

const getDefaultFormValues = (
  channel?: db.Channel | null
): ChannelPrivacyFormSchema => {
  const readerRoles = channel?.readerRoles?.map((r) => r.roleId) ?? [];
  const writerRoles = channel?.writerRoles?.map((r) => r.roleId) ?? [];
  const isPrivate = readerRoles.length > 0 || writerRoles.length > 0;

  const readers = isPrivate
    ? readerRoles.length === 0
      ? ['admin', MEMBERS_MARKER]
      : readerRoles.includes('admin')
        ? readerRoles
        : ['admin', ...readerRoles]
    : [];

  const writers = isPrivate
    ? writerRoles.length === 0
      ? ['admin', MEMBERS_MARKER]
      : writerRoles.includes('admin')
        ? writerRoles
        : ['admin', ...writerRoles]
    : [];

  return {
    readers,
    writers,
    isPrivate,
  };
};

export function EditChannelPrivacyScreenView({
  goBack,
  isLoading,
  onSubmit,
  channel,
  group,
}: EditChannelPrivacyScreenViewProps) {
  const form = useForm<ChannelPrivacyFormSchema>({
    defaultValues: getDefaultFormValues(channel),
    mode: 'onChange',
  });

  const { reset, handleSubmit } = form;

  const handleSave = useCallback(
    (data: ChannelPrivacyFormSchema) => {
      // If MEMBERS_MARKER is present, send empty array (everyone can access)
      // Otherwise, ensure admin is included and send actual role IDs
      const readers = data.readers.includes(MEMBERS_MARKER)
        ? []
        : data.readers.filter((r) => r !== MEMBERS_MARKER);

      const writers = data.writers.includes(MEMBERS_MARKER)
        ? []
        : data.writers.filter((w) => w !== MEMBERS_MARKER);

      onSubmit(readers, writers);
    },
    [onSubmit]
  );

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
          title="Channel privacy"
          subtitle={channel?.title}
          showSubtitle={!!channel?.title}
          backAction={goBack}
          isLoading={isLoading}
        />
        <ScrollView
          flex={1}
          contentContainerStyle={{ paddingBottom: insets.bottom }}
        >
          <YStack gap="$2xl" padding="$xl" alignItems="center">
            {!!group && !!channel && group.roles && (
              <>
                <ChannelPermissionsSelector groupRoles={group.roles} />
                <PermissionTable groupRoles={group.roles} />
              </>
            )}
            <YStack gap="$2xl" width="100%">
              <Button
                hero
                onPress={handleSubmit(handleSave)}
                testID="ChannelPrivacySaveButton"
              >
                <Button.Text>Save</Button.Text>
              </Button>
            </YStack>
          </YStack>
        </ScrollView>
      </View>
    </FormProvider>
  );
}
