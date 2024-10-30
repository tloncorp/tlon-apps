import {
  ChannelContentConfiguration,
  CollectionRendererId,
  DraftInputId,
  PostContentRendererId,
  allCollectionRenderers,
  allContentRenderers,
  allDraftInputs,
  useCreateChannel,
  useGroup,
  useUpdateChannel,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { objectEntries } from '@tloncorp/shared/utils';
import {
  ComponentProps,
  ElementRef,
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useForm } from 'react-hook-form';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SizableText, View, XStack, YStack } from 'tamagui';

import { useCurrentUserId } from '../../contexts';
import { useIsAdmin } from '../../utils';
import { Action, ActionSheet, SimpleActionSheet } from '../ActionSheet';
import { Button } from '../Button';
import * as Form from '../Form';
import { Text } from '../TextV2';

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
  enableCustomChannels = false,
}: {
  onOpenChange: (open: boolean) => void;
  group: db.Group;
  enableCustomChannels?: boolean;
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
        // HACK: We don't have a custom channel type yet, so call it a chat
        data.channelType = 'chat';
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

  const availableChannelTypes = useMemo(
    () =>
      enableCustomChannels
        ? channelTypes
        : channelTypes.filter((t) => t.value !== 'custom'),
    [enableCustomChannels]
  );

  return (
    <ActionSheet
      moveOnKeyboardChange
      open
      onOpenChange={onOpenChange}
      {
        // With the taller sheet content from custom channel form, the sheet is too
        // tall and scrolling doesn't work.
        // When that happens, change snap points from `fit` (i.e. defined by
        // content) to a fixed percent height.
        ...(enableCustomChannels
          ? {
              snapPoints: [85],
              snapPointsMode: 'percent',
            }
          : null)
      }
    >
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
            options={availableChannelTypes}
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

const options = {
  inputs: objectEntries(allDraftInputs).map(([id, { displayName }]) => ({
    title: displayName,
    value: id,
  })),
  content: objectEntries(allContentRenderers).map(([id, { displayName }]) => ({
    title: displayName,
    value: id,
  })),
  collection: objectEntries(allCollectionRenderers).map(
    ([id, { displayName }]) => ({
      title: displayName,
      value: id,
    })
  ),
};

const CustomChannelConfigurationForm = forwardRef<
  {
    getFormValue: () => ChannelContentConfiguration;
  },
  {
    initialValue?: ChannelContentConfiguration;
  }
>(function CustomChannelConfigurationForm({ initialValue }, ref) {
  const { control, getValues } = useForm<ChannelContentConfiguration>({
    defaultValues: initialValue ?? {
      draftInput: DraftInputId.chat,
      defaultPostContentRenderer: PostContentRendererId.chat,
      defaultPostCollectionRenderer: CollectionRendererId.chat,
    },
  });
  useImperativeHandle(ref, () => ({
    getFormValue: () => getValues(),
  }));

  return (
    <>
      <ActionSheet.FormBlock>
        <Form.ControlledRadioField
          name="defaultPostCollectionRenderer"
          label="Collection renderer"
          control={control}
          options={options.collection}
        />
      </ActionSheet.FormBlock>
      <ActionSheet.FormBlock>
        <Form.ControlledRadioField
          name="defaultPostContentRenderer"
          label="Post renderer"
          control={control}
          options={options.content}
        />
      </ActionSheet.FormBlock>
      <ActionSheet.FormBlock>
        <Form.ControlledRadioField
          name="draftInput"
          label="Draft input"
          control={control}
          options={options.inputs}
        />
      </ActionSheet.FormBlock>
    </>
  );
});

export function ChannelConfigurationBar({
  channel,
  onPressDone,
}: {
  channel: db.Channel;
  onPressDone: () => void;
}) {
  const updateChannel = useUpdateChannel();
  const group = useGroup({ id: channel.group?.id }).data;

  const saveConfiguration = useCallback(
    async (configuration: ChannelContentConfiguration) => {
      if (group == null) {
        throw new Error("Couldn't get containing group");
      }
      await updateChannel({
        group,
        channel: {
          ...channel,
          contentConfiguration: configuration,
        },
      });
    },
    [channel, group, updateChannel]
  );

  const insets = useSafeAreaInsets();

  return (
    <YStack
      padding="$xl"
      gap="$2xl"
      borderTopWidth={1}
      borderTopColor="$border"
      paddingBottom={insets.bottom + 20}
      backgroundColor="$secondaryBackground"
    >
      <XStack gap="$m">
        <ConfigInput
          label={'Collection'}
          value={
            channel.contentConfiguration?.defaultPostCollectionRenderer ??
            'not set'
          }
          onChange={(newCollectionType: string) =>
            saveConfiguration({
              ...channel.contentConfiguration!,
              defaultPostCollectionRenderer:
                newCollectionType as CollectionRendererId,
            })
          }
          options={options.collection}
        />
        <ConfigInput
          label={'Content renderer'}
          value={
            channel.contentConfiguration?.defaultPostContentRenderer ??
            'not set'
          }
          onChange={(newContentType: string) => {
            saveConfiguration({
              ...channel.contentConfiguration!,
              defaultPostContentRenderer:
                newContentType as PostContentRendererId,
            });
          }}
          options={options.content}
        />
        <ConfigInput
          label={'Input'}
          value={channel.contentConfiguration?.draftInput ?? 'not set'}
          onChange={(newInputType: string) => {
            saveConfiguration({
              ...channel.contentConfiguration!,
              draftInput: newInputType as DraftInputId,
            });
          }}
          options={options.inputs}
        />
      </XStack>
      <Button hero onPress={onPressDone}>
        <Button.Text>Done</Button.Text>
      </Button>
    </YStack>
  );
}

function ConfigInput({
  label,
  value,
  options,
  onChange,
  ...props
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { title: string; value: string }[];
} & ComponentProps<typeof View>) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const sheetActions: Action[] = useMemo(() => {
    return options.map(
      (option): Action => ({
        title: option.title,
        action: () => {
          setSheetOpen(false);
          onChange(option.value);
        },
        endIcon: option.value === value ? 'Checkmark' : undefined,
      })
    );
  }, [options, value, onChange]);

  const selectedOptionTitle = options.find((o) => o.value === value)?.title;

  return (
    <>
      <YStack flex={1} gap="$m">
        <View
          padding="$xl"
          borderWidth={1}
          borderRadius={'$s'}
          borderColor="$border"
          backgroundColor={'$background'}
          onPress={() => setSheetOpen(true)}
          {...props}
        >
          <Text size="$label/xl" textAlign="center" numberOfLines={1}>
            {selectedOptionTitle ?? 'default'}
          </Text>
        </View>
        <Text
          size="$label/s"
          color="$tertiaryText"
          textAlign="center"
          numberOfLines={1}
        >
          {label}
        </Text>
      </YStack>
      <SimpleActionSheet
        title={label}
        actions={sheetActions}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  );
}

export function EditChannelConfigurationSheetContent({
  channel,
}: {
  channel: db.Channel;
}) {
  const formRef =
    useRef<ElementRef<typeof CustomChannelConfigurationForm>>(null);

  const updateChannel = useUpdateChannel();
  const group = useGroup({ id: channel.group?.id }).data;

  const submit = useCallback(async () => {
    const formValue = formRef.current?.getFormValue();
    if (formValue == null) {
      throw new Error("Couldn't get form value");
    }
    if (group == null) {
      throw new Error("Couldn't get containing group");
    }
    await updateChannel({
      group,
      channel: {
        ...channel,
        contentConfiguration: formValue,
      },
    });
  }, [channel, group, updateChannel]);

  const currentUser = useCurrentUserId();
  const currentUserIsAdmin = useIsAdmin(channel.groupId ?? '', currentUser);

  if (!currentUserIsAdmin) {
    return null;
  }

  return (
    <>
      <SizableText margin="$xl" color="$color.gray500">
        Make sure to save your changes at the bottom.
      </SizableText>
      <CustomChannelConfigurationForm
        ref={formRef}
        initialValue={channel.contentConfiguration ?? undefined}
      />
      <ActionSheet.FormBlock>
        <Button onPress={submit} hero>
          <Button.Text>Save</Button.Text>
        </Button>
      </ActionSheet.FormBlock>
    </>
  );
}
