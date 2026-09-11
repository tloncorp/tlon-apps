import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { createChannel } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { Button } from '@tloncorp/ui';
import { type ComponentProps, useCallback } from 'react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { YStack } from 'tamagui';

import { useCurrentUserId } from '../../../hooks/useCurrentUser';
import { GroupSettingsStackParamList } from '../../../navigation/types';
import { useIsAdmin } from '../../utils/channelUtils';
import { ActionSheet } from '../ActionSheet';
import * as Form from '../Form';
import SystemNotices from '../SystemNotices';
import { PrivateChannelToggle } from './ChannelPermissions';

// The legacy %diary type ('notebook', shown as 'Bulletin') is deliberately
// absent: %notes replaced it and no new diary channels may be created.
export type ChannelTypeName = 'chat' | 'gallery' | 'notes';

const CHANNEL_TYPES: Form.ListItemInputOption<ChannelTypeName>[] = [
  {
    title: 'Chat',
    subtitle: 'A simple, standard text chat',
    value: 'chat',
    icon: 'ChannelTalk',
  },
  {
    title: 'Notebook',
    subtitle: 'Collaborative markdown notebooks',
    value: 'notes',
    icon: 'ChannelNotebooks',
  },
  {
    title: 'Gallery',
    subtitle: 'Gather and arrange rich media',
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
  sheetProps,
}: {
  onOpenChange: (open: boolean) => void;
  group: db.Group;
  sheetProps?: Pick<
    ComponentProps<typeof ActionSheet>,
    'snapPoints' | 'snapPointsMode'
  >;
}) {
  const navigation =
    useNavigation<
      NativeStackNavigationProp<GroupSettingsStackParamList, 'ManageChannels'>
    >();

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

  const currentUserId = useCurrentUserId();
  const isGroupAdmin = useIsAdmin(group.id, currentUserId);
  const isNonHostAdmin = isGroupAdmin && !group.currentUserIsHost;

  const isPrivate = useWatch({ control, name: 'isPrivate' });

  // Only toggles isPrivate without setting readers/writers because:
  // - If private: the user proceeds to CreateChannelPermissionsScreen to configure permissions
  // - If public: readers/writers stay empty (all members have access)
  const handleTogglePrivate = useCallback(
    (value: boolean) => {
      setValue('isPrivate', value, { shouldDirty: true });
    },
    [setValue]
  );

  const handlePressNext = useCallback(() => {
    const title = watch('title');
    const channelType = watch('channelType');
    if (!title) return;

    onOpenChange(false);
    navigation.navigate('CreateChannelPermissions', {
      groupId: group.id,
      channelTitle: title,
      channelType,
    });
  }, [watch, onOpenChange, navigation, group.id]);

  const handlePressSave = useCallback(
    async (data: CreateChannelFormSchema) => {
      createChannel({
        groupId: group.id,
        title: data.title,
        channelType: data.channelType,
        readers: [],
        writers: [],
      });
      onOpenChange(false);
    },
    [group.id, onOpenChange]
  );

  return (
    <FormProvider {...form}>
      <ActionSheet open onOpenChange={onOpenChange} {...sheetProps}>
        <ActionSheet.SimpleHeader title="Create a new channel" />
        <ActionSheet.Content>
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
              options={CHANNEL_TYPES}
              control={control}
              name={'channelType'}
            />
          </ActionSheet.FormBlock>
          {isNonHostAdmin && (
            <ActionSheet.FormBlock>
              <SystemNotices.NonHostAdminChannelNotice />
            </ActionSheet.FormBlock>
          )}
          <ActionSheet.FormBlock>
            <Button
              preset="primary"
              onPress={
                isPrivate ? handlePressNext : handleSubmit(handlePressSave)
              }
              label={isPrivate ? 'Next' : 'Create channel'}
              centered
            />
          </ActionSheet.FormBlock>
        </ActionSheet.Content>
      </ActionSheet>
    </FormProvider>
  );
}
