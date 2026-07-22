import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { createChannel, useNotesDeskAvailable } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { Button } from '@tloncorp/ui';
import { useCallback, useMemo } from 'react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { YStack } from 'tamagui';

import { useCurrentUserId } from '../../../hooks/useCurrentUser';
import { GroupSettingsStackParamList } from '../../../navigation/types';
import { useIsAdmin } from '../../utils/channelUtils';
import { ActionSheet } from '../ActionSheet';
import * as Form from '../Form';
import SystemNotices from '../SystemNotices';
import { PrivateChannelToggle } from './ChannelPermissions';

export type ChannelTypeName = 'chat' | 'notebook' | 'gallery' | 'notes';

// When the notes desk is installed, we offer 'Notebook' as the new
// %notes-backed type and rename the legacy diary type to 'Bulletin'.
// Without the notes desk, the legacy diary type keeps its 'Notebook' label.
function buildChannelTypes(
  notesAvailable: boolean
): Form.ListItemInputOption<ChannelTypeName>[] {
  const chat: Form.ListItemInputOption<ChannelTypeName> = {
    title: 'Chat',
    subtitle: 'A simple, standard text chat',
    value: 'chat',
    icon: 'ChannelTalk',
  };
  const notes: Form.ListItemInputOption<ChannelTypeName> = {
    title: 'Notebook',
    subtitle: 'Collaborative markdown notebooks',
    value: 'notes',
    icon: 'ChannelNotebooks',
  };
  const diary: Form.ListItemInputOption<ChannelTypeName> = {
    title: notesAvailable ? 'Bulletin' : 'Notebook',
    subtitle: 'Longform publishing and discussion',
    value: 'notebook',
    icon: 'Bulletin',
  };
  const gallery: Form.ListItemInputOption<ChannelTypeName> = {
    title: 'Gallery',
    subtitle: 'Gather, connect, and arrange rich media',
    value: 'gallery',
    icon: 'ChannelGalleries',
  };
  return notesAvailable
    ? [chat, notes, diary, gallery]
    : [chat, diary, gallery];
}

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
  const { data: notesAvailable = false } = useNotesDeskAvailable();
  const channelTypes = useMemo(
    () => buildChannelTypes(notesAvailable),
    [notesAvailable]
  );

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
      <ActionSheet open onOpenChange={onOpenChange}>
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
              options={channelTypes}
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
