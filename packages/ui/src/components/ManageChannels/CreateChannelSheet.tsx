import {
  ChannelContentConfiguration,
  CollectionRendererId,
  DraftInputId,
  PostContentRendererId,
  useCreateChannel,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/dist/db';
import {
  ElementRef,
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { useForm } from 'react-hook-form';

import { useCurrentUserId } from '../../contexts';
import { ActionSheet } from '../ActionSheet';
import { Button } from '../Button';
import * as Form from '../Form';

export type ChannelTypeName = 'chat' | 'notebook' | 'gallery' | 'custom';

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
  {
    title: 'Custom',
    subtitle: 'go crazzy',
    value: 'custom',
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
  const customChannelConfigRef =
    useRef<ElementRef<typeof CustomChannelConfigurationForm>>(null);
  const { control, handleSubmit, watch } = useForm<{
    title: string;
    channelType: ChannelTypeName;
  }>({
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
    async (data: { title: string; channelType: ChannelTypeName }) => {
      let contentConfiguration: ChannelContentConfiguration | undefined;
      if (data.channelType === 'custom') {
        contentConfiguration = customChannelConfigRef.current?.getFormValue();
      }
      createChannel({
        title: data.title,
        channelType: data.channelType,
        contentConfiguration,
      });
      onOpenChange(false);
    },
    [createChannel, onOpenChange]
  );

  return (
    <ActionSheet moveOnKeyboardChange open onOpenChange={onOpenChange}>
      <ActionSheet.SimpleHeader title="Create a new channel" />
      <ActionSheet.ScrollableContent maxHeight={500}>
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
        {watch('channelType') === 'custom' && (
          <CustomChannelConfigurationForm ref={customChannelConfigRef} />
        )}
        <ActionSheet.FormBlock>
          <Button onPress={handleSubmit(handlePressSave)} hero>
            <Button.Text>Create channel</Button.Text>
          </Button>
        </ActionSheet.FormBlock>
      </ActionSheet.ScrollableContent>
    </ActionSheet>
  );
}

function labelForDraftInput(draftInputId: DraftInputId): string {
  switch (draftInputId) {
    case DraftInputId.chat:
      return 'Chat';
    case DraftInputId.gallery:
      return 'Gallery';
    case DraftInputId.notebook:
      return 'Notebook';
    case DraftInputId.picto:
      return 'Drawing';
    case DraftInputId.yo:
      return 'Yo';
  }
}
function labelForContentRenderer(r: PostContentRendererId): string {
  switch (r) {
    case PostContentRendererId.chat:
      return 'Chat';
    case PostContentRendererId.gallery:
      return 'Gallery';
    case PostContentRendererId.notebook:
      return 'Notebook';
    case PostContentRendererId.picto:
      return 'Drawing';
  }
}
function labelForCollectionLayout(l: CollectionRendererId): string {
  switch (l) {
    case CollectionRendererId.chat:
      return 'Chat';
    case CollectionRendererId.gallery:
      return 'Gallery';
    case CollectionRendererId.notebook:
      return 'Notebook';
  }
}

const CustomChannelConfigurationForm = forwardRef<{
  getFormValue: () => ChannelContentConfiguration;
}>(function CustomChannelConfigurationForm(_props, ref) {
  const { control, getValues } = useForm<ChannelContentConfiguration>({
    defaultValues: {
      draftInput: DraftInputId.chat,
      defaultPostContentRenderer: PostContentRendererId.chat,
      defaultPostCollectionRenderer: CollectionRendererId.chat,
    },
  });

  const options = useMemo(
    () => ({
      inputs: [
        DraftInputId.chat,
        DraftInputId.gallery,
        DraftInputId.notebook,
        DraftInputId.picto,
        DraftInputId.yo,
      ].map((id) => ({
        title: labelForDraftInput(id),
        value: id,
      })),
      content: [
        PostContentRendererId.chat,
        PostContentRendererId.gallery,
        PostContentRendererId.notebook,
        PostContentRendererId.picto,
      ].map((id) => ({
        title: labelForContentRenderer(id),
        value: id,
      })),
      collection: [
        CollectionRendererId.chat,
        CollectionRendererId.gallery,
        CollectionRendererId.notebook,
      ].map((id) => ({
        title: labelForCollectionLayout(id),
        value: id,
      })),
    }),
    []
  );

  useImperativeHandle(ref, () => ({
    getFormValue: () => getValues(),
  }));

  return (
    <>
      <ActionSheet.FormBlock>
        <Form.ControlledRadioField
          name="draftInput"
          label="Draft input"
          control={control}
          options={options.inputs}
        />
      </ActionSheet.FormBlock>
      <ActionSheet.FormBlock>
        <Form.ControlledRadioField
          name="defaultPostContentRenderer"
          label="Post content renderer"
          control={control}
          options={options.content}
        />
      </ActionSheet.FormBlock>
      <ActionSheet.FormBlock>
        <Form.ControlledRadioField
          name="defaultPostCollectionRenderer"
          label="Collection renderer"
          control={control}
          options={options.collection}
        />
      </ActionSheet.FormBlock>
    </>
  );
});
