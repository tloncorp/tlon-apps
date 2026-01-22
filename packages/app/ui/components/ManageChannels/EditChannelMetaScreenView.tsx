import * as db from '@tloncorp/shared/db';
import { KeyboardAvoidingView } from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';

import {
  ControlledTextField,
  ControlledTextareaField,
  FormFrame,
} from '../Form';
import { ScreenHeader } from '../ScreenHeader';
import { ChannelEditFormLayout } from './ChannelEditFormLayout';

interface ChannelMetaFormSchema {
  title: string;
  description: string;
}

interface EditChannelMetaScreenViewProps {
  goBack: () => void;
  isLoading: boolean;
  channel?: db.Channel | null;
  group?: db.Group | null;
  onSubmit: (title: string, description?: string) => void;
}

export function EditChannelMetaScreenView({
  goBack,
  isLoading,
  onSubmit,
  channel,
  group,
}: EditChannelMetaScreenViewProps) {
  const [modelLoaded, setModelLoaded] = useState(!!channel);
  const defaultValues = useMemo(
    () => ({
      title: channel?.title || '',
      description: channel?.description || '',
    }),
    [channel]
  );

  const {
    control,
    reset,
    handleSubmit,
    formState: { isValid },
  } = useForm<ChannelMetaFormSchema>({
    defaultValues,
  });

  const handleSave = useCallback(
    (data: ChannelMetaFormSchema) => {
      const title = data.title;
      if (!title || typeof title !== 'string') {
        return;
      }
      onSubmit(title, data.description || undefined);
    },
    [onSubmit]
  );

  useEffect(() => {
    if (!modelLoaded && channel) {
      setModelLoaded(true);
      reset(defaultValues);
    }
  }, [channel, modelLoaded, reset, defaultValues]);

  const runSubmit = useCallback(
    () => handleSubmit(handleSave)(),
    [handleSubmit, handleSave]
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }}>
      <ChannelEditFormLayout
        title="Edit channel info"
        channel={channel}
        group={group}
        goBack={goBack}
        isLoading={isLoading}
        rightControls={
          <ScreenHeader.TextButton
            onPress={runSubmit}
            color="$positiveActionText"
            disabled={!isValid}
            testID="ChannelSettingsSaveButton"
          >
            Save
          </ScreenHeader.TextButton>
        }
      >
        <FormFrame paddingBottom="$2xl" flex={1} backgroundType="secondary">
          <ControlledTextField
            name="title"
            label="Name"
            control={control}
            inputProps={{
              placeholder: 'Channel name',
              testID: 'ChannelTitleInput',
            }}
            rules={{
              maxLength: {
                value: 30,
                message: 'Your channel name is limited to 30 characters',
              },
            }}
          />
          <ControlledTextareaField
            name="description"
            label="Description"
            control={control}
            inputProps={{
              placeholder: 'About this channel',
              numberOfLines: 5,
              testID: 'ChannelDescriptionInput',
              multiline: true,
            }}
            rules={{
              maxLength: {
                value: 300,
                message: 'Description is limited to 300 characters',
              },
            }}
          />
        </FormFrame>
      </ChannelEditFormLayout>
    </KeyboardAvoidingView>
  );
}
