import {
  JSONValue,
  useCreateChannel,
  useGroup,
  useUpdateChannel,
} from '@tloncorp/shared';
import {
  ChannelContentConfiguration,
  CollectionRendererId,
  ComponentSpec,
  DraftInputId,
  PostContentRendererId,
  allCollectionRenderers,
  allContentRenderers,
  allDraftInputs,
} from '@tloncorp/shared/api';
import * as db from '@tloncorp/shared/db';
import { objectEntries } from '@tloncorp/shared/utils';
import {
  ComponentProps,
  ElementRef,
  SetStateAction,
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useForm } from 'react-hook-form';
import { Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SizableText, View, XStack, YStack } from 'tamagui';

import { useCurrentUserId } from '../../contexts';
import { useIsAdmin } from '../../utils';
import { Action, ActionSheet, SimpleActionSheet } from '../ActionSheet';
import { Button } from '../Button';
import * as Form from '../Form';
import { Icon } from '../Icon';
import { Text } from '../TextV2';

export function applySetStateAction<T>(prev: T, action: SetStateAction<T>): T {
  if (typeof action === 'function') {
    // @ts-expect-error - react does this as well
    return action(prev);
  } else {
    return action;
  }
}

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
      draftInput: { id: DraftInputId.chat },
      defaultPostContentRenderer: { id: PostContentRendererId.chat },
      defaultPostCollectionRenderer: { id: CollectionRendererId.chat },
    },
  });
  useImperativeHandle(ref, () => ({
    getFormValue: () => getValues(),
  }));

  return (
    <>
      <ActionSheet.FormBlock>
        <Form.ControlledRadioField
          name="defaultPostCollectionRenderer.id"
          label="Collection renderer"
          control={control}
          options={options.collection}
        />
      </ActionSheet.FormBlock>
      <ActionSheet.FormBlock>
        <Form.ControlledRadioField
          name="defaultPostContentRenderer.id"
          label="Post renderer"
          control={control}
          options={options.content}
        />
      </ActionSheet.FormBlock>
      <ActionSheet.FormBlock>
        <Form.ControlledRadioField
          name="draftInput.id"
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
  onPressDone?: () => void;
}) {
  const updateChannel = useUpdateChannel();
  const group = useGroup({ id: channel.group?.id }).data;

  const saveConfiguration = useCallback(
    async (update: SetStateAction<ChannelContentConfiguration | undefined>) => {
      if (group == null) {
        throw new Error("Couldn't get containing group");
      }
      await updateChannel({
        group,
        channel: {
          ...channel,
          contentConfiguration: applySetStateAction(
            channel.contentConfiguration,
            update
          ),
        },
      });
    },
    [channel, group, updateChannel]
  );

  return (
    <UnconnectedChannelConfigurationBar
      channel={channel}
      onPressDone={onPressDone}
      updateChannelConfiguration={saveConfiguration}
    />
  );
}

// exported for fixture
export function UnconnectedChannelConfigurationBar({
  channel,
  onPressDone,
  updateChannelConfiguration,
}: {
  channel: db.Channel;
  onPressDone?: () => void;
  updateChannelConfiguration?: (
    update: (
      prev: ChannelContentConfiguration | undefined
    ) => ChannelContentConfiguration
  ) => void;
}) {
  const insets = useSafeAreaInsets();

  const buildConfigInputProps = useCallback(
    (
      field: keyof ChannelContentConfiguration
    ): Pick<
      ComponentProps<typeof ConfigInput>,
      'value' | 'parametersSchema' | 'onChange'
    > => {
      const kit = (() => {
        switch (field) {
          case 'draftInput':
            return allDraftInputs;
          case 'defaultPostContentRenderer':
            return allContentRenderers;
          case 'defaultPostCollectionRenderer':
            return allCollectionRenderers;
        }
      })();
      const config = (() => {
        if (channel.contentConfiguration == null) {
          return null;
        }
        // use type-coercing getters from ChannelContentConfiguration namespace
        return ChannelContentConfiguration[field](channel.contentConfiguration);
      })();

      const componentId = config?.id;
      const componentSpec: ComponentSpec | undefined =
        // @ts-expect-error - above code ensures that `componentId` is an index into `kit`
        componentId == null ? undefined : kit[componentId];

      return {
        value: config ?? undefined,
        parametersSchema: componentSpec?.parametersSchema,
        onChange: (update) =>
          updateChannelConfiguration?.((prev) => ({
            ...prev!,
            [field]: applySetStateAction(
              // Use type-coercing getter to upgrade any legacy string values
              // into the {id, parameters} form.
              ChannelContentConfiguration[field](prev!),
              update
            ),
          })),
      };
    },
    [channel.contentConfiguration, updateChannelConfiguration]
  );

  return (
    <YStack
      padding="$xl"
      gap="$2xl"
      borderTopWidth={1}
      borderTopColor="$border"
      paddingBottom={insets.bottom + 20}
      backgroundColor="$secondaryBackground"
    >
      <YStack gap="$m">
        <ConfigInput
          label={'Collection'}
          options={options.collection}
          {...buildConfigInputProps('defaultPostCollectionRenderer')}
        />
        <ConfigInput
          label={'Content renderer'}
          options={options.content}
          {...buildConfigInputProps('defaultPostContentRenderer')}
        />
        <ConfigInput
          label={'Input'}
          options={options.inputs}
          {...buildConfigInputProps('draftInput')}
        />
      </YStack>
      <Button hero onPress={onPressDone}>
        <Button.Text>Done</Button.Text>
      </Button>
    </YStack>
  );
}

function ConfigInput<
  Value extends { id: string; configuration?: Record<string, JSONValue> },
>({
  label,
  value,
  options,
  onChange,
  parametersSchema,
  ...props
}: {
  label: string;
  value?: Value;
  parametersSchema?: ComponentSpec['parametersSchema'];
  onChange: (update: SetStateAction<Value>) => void;
  options: { title: string; value: Value['id'] }[];
} & ComponentProps<typeof View>) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [configurationOpen, setConfigurationOpen] = useState(false);

  const sheetActions: Action[] = useMemo(() => {
    return options.map(
      (option): Action => ({
        title: option.title,
        action: () => {
          setSheetOpen(false);
          onChange((prev) => ({ ...prev, id: option.value }));
        },
        endIcon:
          value != null && value.id === option.value ? 'Checkmark' : undefined,
      })
    );
  }, [options, value, onChange]);

  const configurationSheetActions: Action[] = useMemo(() => {
    if (parametersSchema == null) {
      return [];
    }
    return Object.keys(parametersSchema).map((key) => ({
      title: parametersSchema[key].displayName,
      description: (() => {
        switch (parametersSchema[key].type) {
          case 'string': {
            return value?.configuration?.[key] as string | undefined;
          }
          case 'boolean': {
            return value?.configuration?.[key] ? 'Enabled' : 'Disabled';
          }
          case 'radio': {
            return value?.configuration?.[key] as string | undefined;
          }
        }
      })(),
      action: () => {
        const param = parametersSchema[key];
        switch (param.type) {
          case 'string': {
            Alert.prompt(
              'Enter a value',
              undefined,
              (value) => {
                onChange((prev) => ({
                  ...prev,
                  configuration: { ...prev.configuration, [key]: value },
                }));
              },
              undefined,
              value?.configuration?.[key] as string
            );
            break;
          }

          case 'boolean': {
            onChange((prev) => ({
              ...prev,
              configuration: {
                ...prev.configuration,
                [key]: !prev.configuration?.[key],
              },
            }));
            break;
          }

          case 'radio': {
            onChange((prev) => {
              const index = param.options.findIndex(
                (option: { value: string }) =>
                  prev.configuration?.[key] === option.value
              );
              const nextIndex = (index + 1) % param.options.length;
              return {
                ...prev,
                configuration: {
                  ...prev.configuration,
                  [key]: param.options[nextIndex].value,
                },
              };
            });
          }
        }
      },
    }));
  }, [parametersSchema, onChange, value?.configuration]);

  const selectedOptionTitle = options.find((o) =>
    value == null ? false : o.value === value.id
  )?.title;

  return (
    <>
      <XStack gap="$m" alignItems="center">
        <Text size="$label/l" color="$tertiaryText" numberOfLines={1} flex={1}>
          {label}
        </Text>
        <Button
          paddingVertical="$xl"
          minWidth={140}
          onPress={() => setSheetOpen(true)}
          {...props}
        >
          <Text size="$label/xl">{selectedOptionTitle ?? 'default'}</Text>
        </Button>
        <Button
          onPress={() => setConfigurationOpen(true)}
          disabled={
            parametersSchema == null ||
            Object.keys(parametersSchema).length === 0
          }
          disabledStyle={{ opacity: 0.5 }}
        >
          <Icon type="Settings" />
        </Button>
      </XStack>

      <SimpleActionSheet
        title={label}
        actions={sheetActions}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />

      <SimpleActionSheet
        title={[label, 'Tweaks'].join(' • ')}
        actions={configurationSheetActions}
        open={configurationOpen}
        onOpenChange={setConfigurationOpen}
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
