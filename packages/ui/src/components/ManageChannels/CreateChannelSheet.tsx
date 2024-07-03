import { useCallback } from 'react';
import { useForm } from 'react-hook-form';

import { Text, XStack, YStack } from '../../core';
import { ActionSheet } from '../ActionSheet';
import { Button } from '../Button';
import { FormInput } from '../FormInput';
import { Icon } from '../Icon';
import Pressable from '../Pressable';

export type ChannelTypeName = 'chat' | 'notebook' | 'gallery';
type ChannelTypeIcon = 'ChannelTalk' | 'ChannelNotebooks' | 'ChannelGalleries';

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
  currentChannelType?: 'chat' | 'notebook' | 'gallery';
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
    }) => {
      createChannel({
        title: data.title,
        description: data.description,
        channelType: data.channelType as ChannelTypeName,
      });
      onOpenChange(false);
    },
    [createChannel, onOpenChange]
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
