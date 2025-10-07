import {
  JSONValue,
  createChannel,
  useGroup,
  useUpdateChannel,
} from '@tloncorp/shared';
import {
  ChannelContentConfiguration,
  ComponentSpec,
  allCollectionRenderers,
  allContentRenderers,
  allDraftInputs,
} from '@tloncorp/shared/api';
import * as db from '@tloncorp/shared/db';
import { objectEntries } from '@tloncorp/shared/utils';
import { Button, Icon, IconButton, Text } from '@tloncorp/ui';
import {
  ComponentProps,
  SetStateAction,
  useCallback,
  useMemo,
  useState,
} from 'react';
import { FormProvider, useForm, useFormContext } from 'react-hook-form';
import { Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, XStack, YStack } from 'tamagui';

import { Action, ActionSheet, SimpleActionSheet } from '../ActionSheet';
import * as Form from '../Form';
import { ListItem } from '../ListItem';
import {
  PermissionTable,
  PrivateChannelToggle,
  RoleChip,
  RoleSelectionSheet,
  groupRolesToOptions,
} from './EditChannelScreenView';

export function applySetStateAction<T>(prev: T, action: SetStateAction<T>): T {
  if (typeof action === 'function') {
    // @ts-expect-error - react does this as well
    return action(prev);
  } else {
    return action;
  }
}

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

interface CreateChannelFormSchema {
  title: string;
  channelType: ChannelTypeName;
  isPrivate: boolean;
  readers: string[];
  writers: string[];
}

export function CreateChannelSheet({
  onOpenChange,
  group,
}: {
  onOpenChange: (open: boolean) => void;
  group: db.Group;
}) {
  const [pane, setPane] = useState<'initial' | 'permissions'>('initial');
  const form = useForm<CreateChannelFormSchema>({
    defaultValues: {
      title: '',
      channelType: 'chat',
      isPrivate: false,
      readers: [],
      writers: [],
    },
  });

  const { control, handleSubmit, watch, setValue } = form;

  const isPrivate = watch('isPrivate');

  const handleTogglePrivate = useCallback(
    (value: boolean) => {
      setValue('isPrivate', value, { shouldDirty: true });
      const newRoles = value ? ['admin'] : [];
      setValue('readers', newRoles, { shouldDirty: true });
      setValue('writers', newRoles, { shouldDirty: true });
    },
    [setValue]
  );

  const handlePressNext = useCallback(() => {
    setPane('permissions');
  }, []);

  const handlePressBack = useCallback(() => {
    setPane('initial');
  }, []);

  const handlePressSave = useCallback(
    async (data: CreateChannelFormSchema) => {
      const readers = data.isPrivate ? data.readers : [];
      const writers = data.isPrivate ? data.writers : [];

      createChannel({
        groupId: group.id,
        title: data.title,
        channelType: data.channelType,
        readers,
        writers,
      });
      onOpenChange(false);
    },
    [group.id, onOpenChange]
  );

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setPane('initial');
      }
      onOpenChange(open);
    },
    [onOpenChange]
  );

  return (
    <FormProvider {...form}>
      <ActionSheet
        open
        onOpenChange={handleOpenChange}
        snapPoints={pane === 'permissions' ? [85] : undefined}
        snapPointsMode={pane === 'permissions' ? 'percent' : 'fit'}
      >
        {pane === 'initial' ? (
          <>
            <ActionSheet.SimpleHeader title="Create a new channel" />
            <ActionSheet.ScrollableContent>
              <ScrollWrapper>
                <ActionSheet.FormBlock>
                  <Form.ControlledTextField
                    control={control}
                    name="title"
                    label="Title"
                    inputProps={{
                      placeholder: 'Channel title',
                      testID: 'ChannelTitleInput',
                    }}
                    rules={{ required: 'Channel title is required' }}
                  />
                </ActionSheet.FormBlock>
                <ActionSheet.FormBlock>
                  <YStack
                    borderColor="$secondaryBorder"
                    borderWidth={1}
                    borderRadius="$m"
                    overflow="hidden"
                  >
                    <PrivateChannelToggle
                      isPrivate={isPrivate}
                      onTogglePrivate={handleTogglePrivate}
                    />
                  </YStack>
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
                  <Button
                    onPress={
                      isPrivate
                        ? handlePressNext
                        : handleSubmit(handlePressSave)
                    }
                    hero
                  >
                    <Button.Text>
                      {isPrivate ? 'Next' : 'Create channel'}
                    </Button.Text>
                  </Button>
                </ActionSheet.FormBlock>
              </ScrollWrapper>
            </ActionSheet.ScrollableContent>
          </>
        ) : (
          <PrivateChannelPermissionsView
            group={group}
            onPressBack={handlePressBack}
            onPressSave={handleSubmit(handlePressSave)}
          />
        )}
      </ActionSheet>
    </FormProvider>
  );
}

function PrivateChannelPermissionsView({
  group,
  onPressBack,
  onPressSave,
}: {
  group: db.Group;
  onPressBack: () => void;
  onPressSave: () => void;
}) {
  const { watch, setValue } = useFormContext<CreateChannelFormSchema>();
  const readers = watch('readers');
  const [showRoleSelector, setShowRoleSelector] = useState(false);

  const allRoles = useMemo(
    () => groupRolesToOptions(group.roles ?? []),
    [group.roles]
  );

  const handleRemoveRole = useCallback(
    (roleId: string) => {
      if (roleId === 'admin') return;
      setValue(
        'readers',
        readers.filter((r) => r !== roleId),
        {
          shouldDirty: true,
        }
      );
    },
    [readers, setValue]
  );

  const displayedRoles = useMemo(
    () =>
      allRoles
        .filter((role) => readers.includes(role.value))
        .map((role) => ({ label: role.label, value: role.value })),
    [readers, allRoles]
  );

  const handleSaveRoles = useCallback(
    (roleIds: string[]) => {
      setValue('readers', roleIds, { shouldDirty: true });
    },
    [setValue]
  );

  return (
    <>
      <ActionSheet.Header>
        <XStack alignItems="center" gap="$m" width="100%">
          <IconButton onPress={onPressBack} width="$4xl">
            <Icon type="ChevronLeft" />
          </IconButton>
          <ListItem.Title>Channel permissions</ListItem.Title>
        </XStack>
      </ActionSheet.Header>
      <ActionSheet.ScrollableContent>
        <ScrollWrapper>
          <ActionSheet.FormBlock>
            <YStack
              width="100%"
              overflow="hidden"
              borderRadius="$m"
              borderWidth={1}
              borderColor="$secondaryBorder"
              padding="$xl"
              gap="$2xl"
            >
              <XStack>
                <Text size="$label/l" flex={1}>
                  Who can access this channel?
                </Text>
                <XStack flex={1.5} justifyContent="flex-end">
                  <Button
                    width={120}
                    onPress={() => setShowRoleSelector(true)}
                    size={'$l'}
                    backgroundColor="$positiveActionText"
                    pressStyle={{
                      backgroundColor: '$positiveActionText',
                      opacity: 0.9,
                    }}
                    borderColor="$positiveActionText"
                  >
                    <Button.Text color="$positiveBackground">
                      Add roles
                    </Button.Text>
                  </Button>
                </XStack>
              </XStack>
              <YStack gap="$l">
                <Text size="$label/l">Roles</Text>
                <XStack gap="$s" flexWrap="wrap" width="100%">
                  {displayedRoles.map((role) => (
                    <RoleChip
                      key={role.value}
                      role={role}
                      onRemove={
                        role.value !== 'admin'
                          ? () => handleRemoveRole(role.value)
                          : undefined
                      }
                    />
                  ))}
                </XStack>
              </YStack>
            </YStack>
          </ActionSheet.FormBlock>
          <ActionSheet.FormBlock>
            <PermissionTable groupRoles={group.roles ?? []} />
          </ActionSheet.FormBlock>
          <ActionSheet.FormBlock>
            <Button onPress={onPressSave} hero>
              <Button.Text>Create channel</Button.Text>
            </Button>
          </ActionSheet.FormBlock>
        </ScrollWrapper>
      </ActionSheet.ScrollableContent>

      <RoleSelectionSheet
        open={showRoleSelector}
        onOpenChange={setShowRoleSelector}
        allRoles={allRoles}
        selectedRoleIds={readers}
        onSave={handleSaveRoles}
      />
    </>
  );
}

/**
 * Hack: without this, scrolling doesn't work within the ScrollableContent
 */
function ScrollWrapper(props: ComponentProps<typeof View>) {
  return <View pressStyle={{ backgroundColor: '$background' }} {...props} />;
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
            ...(prev ?? ChannelContentConfiguration.defaultConfiguration()),
            [field]: applySetStateAction(
              // Use type-coercing getter to upgrade any legacy string values
              // into the {id, parameters} form.
              prev == null
                ? undefined
                : ChannelContentConfiguration[field](prev),
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
