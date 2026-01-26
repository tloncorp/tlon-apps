import * as db from '@tloncorp/shared/db';
import { useCallback, useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { YStack } from 'tamagui';

import { ScreenHeader } from '../ScreenHeader';
import { ChannelEditFormLayout } from './ChannelEditFormLayout';
import { ChannelPermissionsSelector, PermissionTable } from './ChannelPermissions';
import {
  ChannelPrivacyFormSchema,
  convertFormRolesToBackend,
  getChannelPrivacyDefaults,
} from './channelFormUtils';

interface EditChannelPrivacyScreenViewProps {
  goBack: () => void;
  isLoading: boolean;
  channel?: db.Channel | null;
  group?: db.Group | null;
  onSubmit: (readers: string[], writers: string[]) => void;
}

export function EditChannelPrivacyScreenView({
  goBack,
  isLoading,
  onSubmit,
  channel,
  group,
}: EditChannelPrivacyScreenViewProps) {
  const form = useForm<ChannelPrivacyFormSchema>({
    defaultValues: getChannelPrivacyDefaults(channel),
    mode: 'onChange',
  });

  const { reset, handleSubmit } = form;

  const handleSave = useCallback(
    (data: ChannelPrivacyFormSchema) => {
      const { readers, writers } = convertFormRolesToBackend(
        data.readers,
        data.writers
      );
      onSubmit(readers, writers);
    },
    [onSubmit]
  );

  useEffect(() => {
    if (channel) {
      reset(getChannelPrivacyDefaults(channel));
    }
  }, [channel, reset]);

  const runSubmit = useCallback(
    () => handleSubmit(handleSave)(),
    [handleSubmit, handleSave]
  );

  return (
    <FormProvider {...form}>
      <ChannelEditFormLayout
        title="Channel privacy"
        channel={channel}
        group={group}
        goBack={goBack}
        isLoading={isLoading}
        rightControls={
          <ScreenHeader.TextButton
            onPress={runSubmit}
            color="$positiveActionText"
            testID="ChannelPrivacySaveButton"
          >
            Save
          </ScreenHeader.TextButton>
        }
      >
        <YStack gap="$2xl" padding="$xl" alignItems="center">
          {!!group && !!channel && group.roles && (
            <>
              <ChannelPermissionsSelector groupRoles={group.roles} />
              <PermissionTable groupRoles={group.roles} />
            </>
          )}
        </YStack>
      </ChannelEditFormLayout>
    </FormProvider>
  );
}
