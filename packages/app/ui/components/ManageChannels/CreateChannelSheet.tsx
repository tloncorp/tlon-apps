import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  canGroupHostBuckets,
  createChannel,
  useBucketsDeskAvailable,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { Button, useToast } from '@tloncorp/ui';
import { type ComponentProps, useCallback, useMemo, useState } from 'react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { YStack } from 'tamagui';

import { useCurrentUserId } from '../../../hooks/useCurrentUser';
import { useFeatureFlag } from '../../../lib/featureFlags';
import { GroupSettingsStackParamList } from '../../../navigation/types';
import { useIsAdmin } from '../../utils/channelUtils';
import { ActionSheet } from '../ActionSheet';
import * as Form from '../Form';
import SystemNotices from '../SystemNotices';
import { PrivateChannelToggle } from './ChannelPermissions';

// The legacy %diary type ('notebook', shown as 'Bulletin') is deliberately
// absent: %notes replaced it and no new diary channels may be created.
export type ChannelTypeName = 'chat' | 'gallery' | 'notes' | 'buckets';

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

// Appended rather than listed above, because it is offered only when the
// flag, the desk and the group's host all allow it.
const BUCKETS_CHANNEL_TYPE: Form.ListItemInputOption<ChannelTypeName> = {
  title: 'Buckets',
  subtitle: 'Shared files for members and agents',
  value: 'buckets',
  icon: 'Folder',
};

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
  const toast = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const isGroupAdmin = useIsAdmin(group.id, currentUserId);
  const isNonHostAdmin = isGroupAdmin && !group.currentUserIsHost;
  const [bucketsEnabled] = useFeatureFlag('buckets');
  const { data: bucketsDeskAvailable = false } = useBucketsDeskAvailable();
  const bucketsHostSupported = canGroupHostBuckets(group.hostUserId);
  // Buckets are still behind a flag. This gates the offer, not the channel
  // type: a bucket someone already made keeps working and the host keeps
  // serving it -- only the route to making a new one is closed.
  const bucketsOffered = bucketsEnabled && bucketsDeskAvailable && isGroupAdmin;
  const bucketsAvailable = bucketsOffered && bucketsHostSupported;
  const channelTypes = useMemo(
    () =>
      bucketsAvailable
        ? [...CHANNEL_TYPES, BUCKETS_CHANNEL_TYPE]
        : CHANNEL_TYPES,
    [bucketsAvailable]
  );

  const isPrivate = useWatch({ control, name: 'isPrivate' });
  const selectedChannelType = useWatch({ control, name: 'channelType' });

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
      try {
        setIsCreating(true);
        await createChannel({
          groupId: group.id,
          title: data.title,
          channelType: data.channelType,
          readers: [],
          writers: [],
        });
        onOpenChange(false);
      } catch (cause) {
        toast({
          message:
            cause instanceof Error
              ? cause.message
              : 'Could not create this channel',
        });
      } finally {
        setIsCreating(false);
      }
    },
    [group.id, onOpenChange, toast]
  );

  return (
    <FormProvider {...form}>
      <ActionSheet open onOpenChange={onOpenChange} {...sheetProps}>
        <ActionSheet.SimpleHeader title="Create a new channel" />
        <ActionSheet.ScrollableContent keyboardShouldPersistTaps="handled">
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
          {bucketsOffered && !bucketsHostSupported && (
            <ActionSheet.FormBlock>
              <SystemNotices.NoticeFrame>
                <SystemNotices.NoticeBody>
                  Buckets are currently available only in groups hosted on Tlon.
                </SystemNotices.NoticeBody>
              </SystemNotices.NoticeFrame>
            </ActionSheet.FormBlock>
          )}
          {isNonHostAdmin && (
            <ActionSheet.FormBlock>
              <SystemNotices.NonHostAdminChannelNotice
                bucketHostedByGroup={selectedChannelType === 'buckets'}
              />
            </ActionSheet.FormBlock>
          )}
          <ActionSheet.FormBlock>
            <Button
              preset="primary"
              onPress={
                isPrivate ? handlePressNext : handleSubmit(handlePressSave)
              }
              label={isPrivate ? 'Next' : 'Create channel'}
              loading={isCreating}
              disabled={isCreating}
              centered
            />
          </ActionSheet.FormBlock>
        </ActionSheet.ScrollableContent>
      </ActionSheet>
    </FormProvider>
  );
}
