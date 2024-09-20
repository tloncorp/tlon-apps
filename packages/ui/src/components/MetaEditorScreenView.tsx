import * as db from '@tloncorp/shared/dist/db';
import * as logic from '@tloncorp/shared/dist/logic';
import { PropsWithChildren, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { View, YStack } from 'tamagui';

import { Button } from './Button';
import { EditablePofileImages } from './EditableProfileImages';
import { FormInput } from './FormInput';
import KeyboardAvoidingView from './KeyboardAvoidingView';
import { GenericHeader } from './ScreenHeader';

export function MetaEditorScreenView({
  title,
  goBack,
  children,
  onSubmit,
  chat,
}: PropsWithChildren<{
  title: string;
  onSubmit: (meta: db.ClientMeta) => void;
  goBack: () => void;
  chat?: db.Group | db.Channel | null;
}>) {
  const [modelLoaded, setModelLoaded] = useState(!!chat);
  const defaultValues = useMemo(() => getMetaWithDefaults(chat), [chat]);
  const { group, channel } = useMemo(() => {
    if (chat) {
      return logic.isGroup(chat)
        ? { group: chat, channel: null }
        : { group: null, channel: chat };
    }
    return { group: null, channel: null };
  }, [chat]);

  const {
    control,
    handleSubmit,
    formState: { errors },
    setValue,
    reset,
  } = useForm({
    defaultValues,
  });

  useEffect(() => {
    if (!modelLoaded && chat) {
      setModelLoaded(true);
      reset(defaultValues);
    }
  }, [chat, modelLoaded, reset, defaultValues]);

  const saveButton = useMemo(() => {
    return <SaveButton onPress={handleSubmit(onSubmit)} />;
  }, [handleSubmit, onSubmit]);

  return (
    <View backgroundColor="$background" flex={1}>
      <YStack justifyContent="space-between" width="100%" height="100%">
        <GenericHeader
          title={title}
          goBack={goBack}
          rightContent={saveButton}
        />
        <KeyboardAvoidingView style={{ flex: 1 }}>
          <YStack gap="$2xl" padding="$xl" alignItems="center" flex={1}>
            <EditablePofileImages
              group={group}
              channel={channel}
              onSetCoverUrl={(url) => setValue('coverImage', url)}
              onSetIconUrl={(url) => setValue('iconImage', url)}
            />
            <YStack gap="$m" width="100%">
              <FormInput
                name="title"
                label="Group Name"
                control={control}
                errors={errors}
                rules={{ required: 'Group name is required' }}
                placeholder="Group Name"
              />
              <FormInput
                name="description"
                label="Group Description"
                control={control}
                errors={errors}
                placeholder="Group Description"
              />
              {children}
            </YStack>
          </YStack>
        </KeyboardAvoidingView>
      </YStack>
    </View>
  );
}

export function SaveButton({ onPress }: { onPress: () => void }) {
  return (
    <Button minimal onPress={onPress} borderWidth="unset">
      <Button.Text>Save</Button.Text>
    </Button>
  );
}

export function getMetaWithDefaults(
  chat: db.Group | db.Channel | null | undefined,
  defaults = {
    title: '',
    description: '',
    coverImage: '',
    iconImage: '',
  }
) {
  return {
    title: chat?.title || defaults.title,
    description: chat?.description || defaults.description,
    coverImage: chat?.coverImage || defaults.coverImage,
    iconImage: chat?.iconImage || defaults.iconImage,
  };
}
