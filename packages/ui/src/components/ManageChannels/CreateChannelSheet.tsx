import { useCallback } from 'react';
import { useForm } from 'react-hook-form';

import { Text, XStack, YStack } from '../../core';
import { ActionSheet } from '../ActionSheet';
import { Button } from '../Button';
import { FormInput } from '../FormInput';
import { Icon } from '../Icon';
import Pressable from '../Pressable';

export type ChannelTypeName =
  | 'chat'
  | 'notebook'
  | 'gallery'
  | 'picto'
  | 'echo'
  | 'cameraRoll';

type ChannelTypeIcon =
  | 'ChannelTalk'
  | 'ChannelNotebooks'
  | 'ChannelGalleries'
  | 'Draw'
  | 'Record'
  | 'Camera';

type ChannelType = {
  title: string;
  description: string;
  channelType: ChannelTypeName;
  iconType: ChannelTypeIcon;
};

const channelTypes: ChannelType[] = [
  {
    title: 'Chat channel',
    description: 'A simple, standard text chat',
    channelType: 'chat',
    iconType: 'ChannelTalk',
  },
  {
    title: 'Notebook channel',
    description: 'Longform publishing and discussion',
    channelType: 'notebook',
    iconType: 'ChannelNotebooks',
  },
  {
    title: 'Gallery channel',
    description: 'Gather, connect, and arrange rich media',
    channelType: 'gallery',
    iconType: 'ChannelGalleries',
  },
  {
    title: 'Echo chamber',
    description: 'Repeat the same message with friends',
    channelType: 'echo',
    iconType: 'Record',
  },
  {
    title: 'Pictochat',
    description: 'Draw and chat with friends',
    channelType: 'picto',
    iconType: 'Draw',
  },
  {
    title: 'Camera roll',
    description: 'Shared camera',
    channelType: 'cameraRoll',
    iconType: 'Camera',
  },
];

function ChannelTypeRow({
  channelType,
  iconType,
  channelTypeTitle,
  description,
  onPress,
  currentChannelType,
}: {
  channelType: ChannelTypeName;
  iconType: ChannelTypeIcon;
  channelTypeTitle: string;
  description: string;
  onPress: () => void;
  currentChannelType?: ChannelTypeName;
}) {
  return (
    <Pressable onPress={onPress}>
      <XStack
        padding="$s"
        alignItems="center"
        justifyContent="space-between"
        width="100%"
      >
        <XStack gap="$s" alignItems="center">
          <Icon type={iconType} />
          <YStack gap="$s" width="80%">
            <Text>{channelTypeTitle}</Text>
            <Text fontSize="$s">{description}</Text>
          </YStack>
        </XStack>
        {currentChannelType === channelType && <Icon type="Checkmark" />}
      </XStack>
    </Pressable>
  );
}

export function CreateChannelSheet({
  onOpenChange,
  createChannel,
}: {
  onOpenChange: (open: boolean) => void;
  createChannel: ({
    title,
    description,
    channelType,
  }: {
    title: string;
    description: string;
    channelType: ChannelTypeName;
  }) => void;
}) {
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      title: '',
      description: '',
      channelType: 'chat',
    },
  });

  const channelType = watch('channelType');

  const handlePressSave = useCallback(
    async (data: {
      title: string;
      description: string;
      channelType: string;
      echo: string;
    }) => {
      createChannel({
        title: data.title,
        description:
          channelType === 'cameraRoll'
            ? JSON.stringify({ type: 'cameraRoll' })
            : channelType === 'picto'
              ? JSON.stringify({ type: 'picto' })
              : channelType === 'echo'
                ? JSON.stringify({ type: 'echo', meta: { message: data.echo } })
                : data.description,
        channelType:
          channelType === 'picto' ||
          channelType === 'cameraRoll' ||
          channelType === 'echo'
            ? 'chat'
            : (data.channelType as ChannelTypeName),
      });
      onOpenChange(false);
    },
    [channelType, createChannel, onOpenChange]
  );

  return (
    <ActionSheet moveOnKeyboardChange open={true} onOpenChange={onOpenChange}>
      <ActionSheet.Header>
        <ActionSheet.Title>Create a new channel</ActionSheet.Title>
        <YStack
          alignItems="center"
          justifyContent="space-between"
          paddingTop="$l"
          gap="$l"
          width="100%"
        >
          <FormInput
            control={control}
            errors={errors}
            name="title"
            label="Title"
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
          {channelType === 'echo' && (
            <FormInput
              control={control}
              errors={errors}
              name="echo"
              label="Echo message"
              rules={{ required: 'Message is required' }}
            />
          )}
          <YStack
            gap="$xl"
            width="100%"
            borderWidth={1}
            borderRadius="$l"
            borderColor="$secondaryBorder"
            padding="$l"
          >
            {channelTypes.map((c) => (
              <ChannelTypeRow
                key={c.channelType}
                iconType={c.iconType}
                channelType={c.channelType}
                channelTypeTitle={c.title}
                description={c.description}
                currentChannelType={channelType as ChannelTypeName}
                onPress={() => setValue('channelType', c.channelType)}
              />
            ))}
          </YStack>
          <Text>
            By default, everyone can read the entire history, can write to the
            channel, and comment on all posts.
          </Text>
          <Button hero onPress={handleSubmit(handlePressSave)}>
            <Button.Text>Create a new channel</Button.Text>
          </Button>
        </YStack>
      </ActionSheet.Header>
    </ActionSheet>
  );
}
