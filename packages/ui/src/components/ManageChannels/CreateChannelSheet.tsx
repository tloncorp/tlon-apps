import { useCreateChannel } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/dist/db';
import { useCallback } from 'react';
import { useForm } from 'react-hook-form';

import { useCurrentUserId } from '../../contexts';
import { ActionSheet } from '../ActionSheet';
import { Button } from '../Button';
import * as Form from '../Form';

export type ChannelTypeName = 'chat' | 'notebook' | 'gallery';

const channelTypes: Form.ListItemInputOption<ChannelTypeName>[] = [
  {
    title: 'Chat',
    subtitle: 'A simple, standard text chat',
    value: 'chat',
    icon: 'ChannelTalk',
  },
  {
    title: 'Notebook',
    subtitle: 'Longform publishing and discussion',
    value: 'notebook',
    icon: 'ChannelNotebooks',
  },
  {
    title: 'Gallery',
    subtitle: 'Gather, connect, and arrange rich media',
    value: 'gallery',
    icon: 'ChannelGalleries',
  },
];

export function CreateChannelSheet({
  onOpenChange,
  group,
}: {
  onOpenChange: (open: boolean) => void;
  group: db.Group;
}) {
  const { control, handleSubmit } = useForm({
    defaultValues: {
      title: '',
      channelType: 'chat',
    },
  });

  const currentUserId = useCurrentUserId();
  const createChannel = useCreateChannel({
    group,
    currentUserId,
  });
  const handlePressSave = useCallback(
    async (data: { title: string; channelType: string }) => {
      createChannel({
        title: data.title,
        channelType: data.channelType as ChannelTypeName,
      });
      onOpenChange(false);
    },
    [createChannel, onOpenChange]
  );

  return (
    <ActionSheet moveOnKeyboardChange open={true} onOpenChange={onOpenChange}>
      <ActionSheet.SimpleHeader title="Create a new channel" />
      <ActionSheet.ScrollableContent>
        <ActionSheet.FormBlock>
          <Form.ControlledTextField
            control={control}
            name="title"
            label="Title"
            inputProps={{ placeholder: 'Channel title' }}
            rules={{ required: 'Channel title is required' }}
          />
        </ActionSheet.FormBlock>
        <ActionSheet.FormBlock>
          <Form.ControlledListItemField
            label="Channel type"
            options={channelTypes}
            control={control}
            name={'channelType'}
          />
        </ActionSheet.FormBlock>
        <ActionSheet.FormBlock>
          <Button onPress={handleSubmit(handlePressSave)} hero>
            <Button.Text>Create channel</Button.Text>
          </Button>
        </ActionSheet.FormBlock>
      </ActionSheet.ScrollableContent>
    </ActionSheet>
  );
}
