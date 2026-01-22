import * as db from '@tloncorp/shared/db';
import { Button, FormInput } from '@tloncorp/ui';
import { useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, View, YStack } from 'tamagui';

import { ScreenHeader } from '../ScreenHeader';

interface ChannelMetaFormSchema {
  title: string | null | undefined;
  description: string | null | undefined;
}

interface EditChannelMetaScreenViewProps {
  goBack: () => void;
  isLoading: boolean;
  channel?: db.Channel | null;
  onSubmit: (title: string, description?: string) => void;
}

export function EditChannelMetaScreenView({
  goBack,
  isLoading,
  onSubmit,
  channel,
}: EditChannelMetaScreenViewProps) {
  const {
    control,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<ChannelMetaFormSchema>({
    defaultValues: {
      title: channel?.title,
      description: channel?.description,
    },
    mode: 'onChange',
  });

  const handleSave = useCallback(
    (data: ChannelMetaFormSchema) => {
      const title = data.title;
      if (!title || typeof title !== 'string') {
        return;
      }
      onSubmit(title, data.description ?? undefined);
    },
    [onSubmit]
  );

  useEffect(() => {
    if (channel) {
      reset({
        title: channel.title,
        description: channel.description,
      });
    }
  }, [channel, reset]);

  const insets = useSafeAreaInsets();

  return (
    <View backgroundColor="$background" flex={1}>
      <ScreenHeader
        title="Edit channel"
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
          {isLoading || !channel ? null : (
            <YStack width="100%" gap="$2xl">
              <FormInput
                control={control}
                errors={errors}
                name="title"
                label="Title"
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
          <YStack gap="$2xl" width="100%">
            <Button
              hero
              onPress={handleSubmit(handleSave)}
              testID="ChannelSettingsSaveButton"
            >
              <Button.Text>Save</Button.Text>
            </Button>
          </YStack>
        </YStack>
      </ScrollView>
    </View>
  );
}
