import { useChannelHooksPreview, useCreateChannel } from '@tloncorp/shared';
import * as api from '@tloncorp/shared/api';
import * as db from '@tloncorp/shared/db';
import { useCallback, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SizableText, View, XStack, YStack } from 'tamagui';

import { useCurrentUserId, useGroups } from '../contexts';
import { useAlphabeticallySegmentedGroups } from '../hooks/groupsSorters';
import useIsWindowNarrow from '../hooks/useIsWindowNarrow';
import { Button } from './Button';
import * as Form from './Form';
import { GroupSelector } from './GroupSelector';
import { ListItem } from './ListItem';
import { ScreenHeader } from './ScreenHeader';

export function ChannelFromTemplateView({
  channel,
  goBack,
  navigateToChannel,
}: {
  channel?: db.Channel;
  goBack: () => void;
  navigateToChannel: (channel: db.Channel) => void;
}) {
  const { bottom } = useSafeAreaInsets();
  const isWindowNarrow = useIsWindowNarrow();
  const [selectedGroup, setSelectedGroup] = useState<db.Group | null>(null);
  const { data: hookPreviews } = useChannelHooksPreview(channel?.id ?? '');
  const currentUserId = useCurrentUserId();
  const allGroups = useGroups();
  const groups = useMemo(() => {
    return allGroups?.filter((g) => g.title && g.currentUserIsHost) ?? [];
  }, [allGroups]);
  const alphaSegmentedGroups = useAlphabeticallySegmentedGroups({
    groups,
    enabled: true,
  });
  const {
    control,
    formState: { isValid, errors },
    handleSubmit,
  } = useForm<{
    title: string;
  }>({
    defaultValues: {
      title: '',
    },
  });

  console.log(errors);

  const createChannel = useCreateChannel({
    group: selectedGroup,
    currentUserId,
  });

  const onConfirm = useCallback(
    async (data: { title: string }) => {
      console.log('onConfirm', channel, selectedGroup);
      if (!channel || !selectedGroup) {
        return;
      }

      console.log('creating channel', data);
      // create channel
      const newChannel = await createChannel({
        title: data.title,
        channelType: channel.type,
      });
      console.log('channel created', newChannel);
      if (newChannel) {
        // send hook template setup
        console.log('sending template');
        await api.setupChannelFromTemplate(channel.id, newChannel.id);
        console.log('template setup');
        // navigate to channel
        navigateToChannel(newChannel);
      }
    },
    [navigateToChannel, channel, selectedGroup]
  );

  return (
    <View
      flex={1}
      height="100%"
      paddingBottom={bottom}
      backgroundColor="$background"
    >
      <ScreenHeader
        title="New Channel with Modifications"
        backAction={goBack}
      />
      <YStack
        flex={1}
        height={isWindowNarrow ? undefined : '100%'}
        width={isWindowNarrow ? undefined : '100%'}
        display={isWindowNarrow ? undefined : 'flex'}
        flexDirection={isWindowNarrow ? undefined : 'column'}
      >
        <View
          paddingHorizontal="$l"
          paddingBottom="$xl"
          borderBottomColor="$border"
          borderBottomWidth={1}
        >
          <Form.FieldLabel paddingTop="$l">
            Modifications running in this channel:
          </Form.FieldLabel>
          <YStack gap={2}>
            {(hookPreviews || []).map(({ name, meta }, index) => (
              <ListItem key={`hook-${index}`}>
                {meta.image ? (
                  <ListItem.ImageIcon imageUrl={meta.image} />
                ) : (
                  <ListItem.SystemIcon icon="CodeBlock" />
                )}
                <ListItem.MainContent>
                  <ListItem.Title>{meta.title || name}</ListItem.Title>
                  {meta.description && (
                    <ListItem.Subtitle>{meta.description}</ListItem.Subtitle>
                  )}
                </ListItem.MainContent>
              </ListItem>
            ))}
          </YStack>
        </View>
        <Form.ControlledTextField
          control={control}
          name="title"
          label="Title"
          inputProps={{ placeholder: 'Channel title' }}
          rules={{ required: 'Channel title is required' }}
          paddingVertical="$xl"
          paddingHorizontal="$2xl"
          borderBottomColor="$border"
          borderBottomWidth={1}
        />
        <View flex={1} paddingVertical="$xl" paddingHorizontal="$2xl">
          <Form.FieldLabel>Choose where to create this channel</Form.FieldLabel>
          <View>
            <GroupSelector
              selected={selectedGroup?.id ? [selectedGroup.id] : []}
              onSelect={setSelectedGroup}
              alphaSegmentedGroups={alphaSegmentedGroups}
            />
          </View>
        </View>
        <Button
          hero
          marginHorizontal="$2xl"
          onPress={handleSubmit(onConfirm)}
          disabled={!channel || !selectedGroup || !isValid}
        >
          <Button.Text>Create Channel</Button.Text>
        </Button>
      </YStack>
    </View>
  );
}
