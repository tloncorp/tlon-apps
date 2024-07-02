import * as db from '@tloncorp/shared/dist/db';
import { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';

import { Text, View, XStack, YStack } from '../../core';
import { Button } from '../Button';
import { DeleteSheet } from '../DeleteSheet';
import { FormInput } from '../FormInput';
import { GenericHeader } from '../GenericHeader';

interface EditChannelScreenViewProps {
  goBack: () => void;
  isLoading: boolean;
  channel?: db.Channel;
  submit: (title: string, description?: string) => void;
  deleteChannel: () => void;
}

export function EditChannelScreenView({
  goBack,
  isLoading,
  submit,
  channel,
  deleteChannel,
}: EditChannelScreenViewProps) {
  const [showDeleteSheet, setShowDeleteSheet] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      title: channel?.title,
      description: channel?.description,
    },
  });

  const handleSave = useCallback(
    (data: {
      title: string | null | undefined;
      description: string | null | undefined;
    }) => {
      if (!data.title) {
        return;
      }
      submit(data.title, data.description ?? undefined);
    },
    [submit]
  );

  return (
    <View backgroundColor="$background" flex={1}>
      <YStack
        backgroundColor="$background"
        justifyContent="space-between"
        flex={1}
      >
        <GenericHeader
          title="Edit channel"
          goBack={goBack}
          showSpinner={isLoading}
        />

        <YStack
          backgroundColor="$background"
          gap="$2xl"
          padding="$xl"
          alignItems="center"
          flex={1}
        >
          {isLoading ? null : (
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
            <Button.Text>Delete channel</Button.Text>
          </Button>
          <DeleteSheet
            open={showDeleteSheet}
            onOpenChange={(show) => setShowDeleteSheet(show)}
            title={channel?.title ?? 'channel'}
            itemTypeDescription="channel"
            deleteAction={deleteChannel}
          />
        </YStack>
      </YStack>
    </View>
  );
}
