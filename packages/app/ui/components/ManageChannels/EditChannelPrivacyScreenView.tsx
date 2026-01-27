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
  onCreateRole?: () => void;
  createdRoleId?: string;
}

export function EditChannelPrivacyScreenView({
  goBack,
  isLoading,
  onSubmit,
  channel,
  group,
  onCreateRole,
  createdRoleId,
}: EditChannelPrivacyScreenViewProps) {
  const form = useForm<ChannelPrivacyFormSchema>({
    defaultValues: getChannelPrivacyDefaults(channel),
    mode: 'onChange',
  });

  const { reset, handleSubmit, watch, setValue } = form;

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

  // Handle newly created role being returned from AddRole screen
  useEffect(() => {
    if (createdRoleId) {
      const currentReaders = watch('readers');
      if (!currentReaders.includes(createdRoleId)) {
        // Enable private mode and add the new role
        setValue('isPrivate', true, { shouldDirty: true });
        setValue('readers', ['admin', createdRoleId], { shouldDirty: true });
        setValue('writers', ['admin', createdRoleId], { shouldDirty: true });
      }
    }
  }, [createdRoleId, setValue, watch]);

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
              <ChannelPermissionsSelector
                groupRoles={group.roles}
                onCreateRole={onCreateRole}
              />
              <PermissionTable groupRoles={group.roles} />
            </>
          )}
        </YStack>
      </ChannelEditFormLayout>
    </FormProvider>
  );
}
