import * as db from '@tloncorp/shared/dist/db';
import { ImagePickerAsset } from 'expo-image-picker';
import { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { View, YStack } from 'tamagui';

import { AttachmentProvider } from '../contexts/attachment';
import { Button } from './Button';
import { DeleteSheet } from './DeleteSheet';
import { EditablePofileImages } from './EditableProfileImages';
import { FormInput } from './FormInput';
import { GenericHeader } from './GenericHeader';
import KeyboardAvoidingView from './KeyboardAvoidingView';
import { LoadingSpinner } from './LoadingSpinner';

interface GroupMetaScreenViewProps {
  group: db.Group | null;
  deleteGroup: () => void;
  // leaving this prop here in case it's needed later
  // no non-admin should be able to access this screen anyway
  currentUserIsAdmin: boolean;
  setGroupMetadata: (metadata: db.ClientMeta) => void;
  goBack: () => void;
  uploadAsset: (asset: ImagePickerAsset) => Promise<void>;
  canUpload: boolean;
}

export function SaveButton({ onPress }: { onPress: () => void }) {
  return (
    <Button minimal onPress={onPress} borderWidth="unset">
      <Button.Text>Save</Button.Text>
    </Button>
  );
}

export function GroupMetaScreenView({
  group,
  setGroupMetadata,
  deleteGroup,
  goBack,
  uploadAsset,
  canUpload,
}: GroupMetaScreenViewProps) {
  const [showDeleteSheet, setShowDeleteSheet] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm({
    defaultValues: {
      title: group?.title ?? '',
      description: group?.description ?? '',
      coverImage: group?.coverImage ?? '',
      iconImage: group?.iconImage ?? '',
    },
  });

  const onSubmit = useCallback(
    (data: {
      title: string;
      description: string;
      coverImage: string;
      iconImage: string;
    }) => {
      setGroupMetadata({
        title: data.title,
        description: data.description,
        coverImage: data?.coverImage,
        iconImage: data?.iconImage,
      });

      goBack();
    },
    [setGroupMetadata, goBack]
  );

  if (!group) {
    return <LoadingSpinner />;
  }

  return (
    <AttachmentProvider canUpload={canUpload} uploadAsset={uploadAsset}>
      <View backgroundColor="$background" flex={1}>
        <YStack justifyContent="space-between" width="100%" height="100%">
          <GenericHeader
            title="Edit Group Info"
            goBack={goBack}
            rightContent={<SaveButton onPress={handleSubmit(onSubmit)} />}
          />
          <KeyboardAvoidingView>
            <YStack gap="$2xl" padding="$xl" alignItems="center" flex={1}>
              <EditablePofileImages
                group={group}
                onSetCoverUrl={(url) => setValue('coverImage', url)}
                onSetIconUrl={(url) => setValue('iconImage', url)}
              />
              <YStack gap="$m" width="100%">
                <FormInput
                  name="title"
                  label="Group Name"
                  control={control}
                  errors={errors}
                  rules={{ required: 'Group name is required' }}
                  placeholder="Group Name"
                />
                <FormInput
                  name="description"
                  label="Group Description"
                  control={control}
                  errors={errors}
                  placeholder="Group Description"
                />
                <Button
                  heroDestructive
                  onPress={() => setShowDeleteSheet(true)}
                >
                  <Button.Text>Delete group for everyone</Button.Text>
                </Button>
              </YStack>
            </YStack>
          </KeyboardAvoidingView>
        </YStack>
        <DeleteSheet
          title={group.title ?? 'This Group'}
          itemTypeDescription="group"
          open={showDeleteSheet}
          onOpenChange={setShowDeleteSheet}
          deleteAction={deleteGroup}
        />
      </View>
    </AttachmentProvider>
  );
}
