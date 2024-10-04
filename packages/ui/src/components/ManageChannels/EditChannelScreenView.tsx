import * as db from '@tloncorp/shared/dist/db';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { View, YStack } from 'tamagui';

import { Button } from '../Button';
import { DeleteSheet } from '../DeleteSheet';
import { FormInput } from '../FormInput';
import { ScreenHeader } from '../ScreenHeader';

interface EditChannelScreenViewProps {
  goBack: () => void;
  isLoading: boolean;
  channel?: db.Channel | null;
  onSubmit: (title: string, description?: string) => void;
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
  const {
    control,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      title: channel?.title,
      description: channel?.description,
    },
  });

  useEffect(() => {
    if (channel) {
      reset({
        title: channel.title,
        description: channel.description,
      });
    }
  }, [channel, reset]);

  const handleSave = useCallback(
    (data: {
      title: string | null | undefined;
      description: string | null | undefined;
    }) => {
      if (!data.title) {
        return;
      }
      onSubmit(data.title, data.description ?? undefined);
    },
    [onSubmit]
  );

  return (
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
            <>
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
            </>
          )}
          <Button hero onPress={handleSubmit(handleSave)}>
            <Button.Text>Save</Button.Text>
          </Button>
          <Button heroDestructive onPress={() => setShowDeleteSheet(true)}>
            <Button.Text>Delete channel for everyone</Button.Text>
          </Button>
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
  );
}
