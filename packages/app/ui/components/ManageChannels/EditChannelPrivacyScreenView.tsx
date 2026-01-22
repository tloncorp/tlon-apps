import * as db from '@tloncorp/shared/db';
import { Button } from '@tloncorp/ui';
import { useCallback, useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { YStack } from 'tamagui';

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

  return (
    <FormProvider {...form}>
      <ChannelEditFormLayout
        title="Channel privacy"
        channel={channel}
        group={group}
        goBack={goBack}
        isLoading={isLoading}
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
      </ChannelEditFormLayout>
    </FormProvider>
  );
}
