import {
  AnalyticsEvent,
  createChannel,
  createDevLogger,
  deleteChannel,
  useChannelHooksPreview,
} from '@tloncorp/shared';
import * as api from '@tloncorp/shared/api';
import * as db from '@tloncorp/shared/db';
import { useIsWindowNarrow } from '@tloncorp/ui';
import { Button } from '@tloncorp/ui';
import { useCallback, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, YStack } from 'tamagui';

import { useCurrentUserId, useGroups } from '../contexts';
import { useAlphabeticallySegmentedGroups } from '../hooks/groupsSorters';
import * as Form from './Form';
import { GroupSelector } from './GroupSelector';
import { ListItem } from './ListItem';
import { ScreenHeader } from './ScreenHeader';

const logger = createDevLogger('copy-channel-template', false);

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

  const onConfirm = useCallback(
    async (data: { title: string }) => {
      logger.log('onConfirm', channel, selectedGroup);
      if (!channel || !selectedGroup) {
        return;
      }

      logger.log('creating channel', data);
      // create channel
      const newChannel = await createChannel({
        groupId: selectedGroup.id,
        title: data.title,
        channelType: channel.type,
      });
      logger.log('channel created', newChannel);

      if (!newChannel) {
        return;
      }

      try {
        // send hook template setup
        logger.log('sending template');
        await api.setupChannelFromTemplate(channel.id, newChannel.id);
        logger.log('template setup');
        logger.trackEvent(AnalyticsEvent.ChannelTemplateSetup);
        // navigate to channel
        navigateToChannel(newChannel);
      } catch (e) {
        logger.trackError('Failed to setup channel template', e);
        deleteChannel({
          channelId: newChannel.id,
          groupId: newChannel.groupId ?? '',
        });
        Alert.alert('Channel failed to setup with modifications');
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
          fill="solid"
          type="primary"
          marginHorizontal="$2xl"
          onPress={handleSubmit(onConfirm)}
          disabled={!channel || !selectedGroup || !isValid}
          label="Create Channel"
          centered
        />
      </YStack>
    </View>
  );
}
