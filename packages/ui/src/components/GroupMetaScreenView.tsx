import {
  MessageAttachments,
  UploadInfo,
  UploadedFile,
} from '@tloncorp/shared/dist/api';
import * as db from '@tloncorp/shared/dist/db';
import { ImageBackground } from 'expo-image';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { getTokenValue } from 'tamagui';

import { Text, View, YStack } from '../core';
import AttachmentSheet from './AttachmentSheet';
import { GroupAvatar } from './Avatar';
import { Button } from './Button';
import { DeleteSheet } from './DeleteSheet';
import { FormInput } from './FormInput';
import { GenericHeader } from './GenericHeader';
import KeyboardAvoidingView from './KeyboardAvoidingView';
import { LoadingSpinner } from './LoadingSpinner';
import Pressable from './Pressable';

interface GroupMetaScreenViewProps {
  group: db.Group | null;
  deleteGroup: () => void;
  // leaving this prop here in case it's needed later
  // no non-admin should be able to access this screen anyway
  currentUserIsAdmin: boolean;
  setGroupMetadata: (metadata: db.ClientMeta) => void;
  goBack: () => void;
  uploadInfo: UploadInfo;
}

export function SaveButton({ onPress }: { onPress: () => void }) {
  return (
    <Button onPress={onPress} borderWidth="unset">
      <Button.Text>Save</Button.Text>
    </Button>
  );
}

function ExplanationPressable({
  onPress,
  canUpload,
}: {
  onPress: () => void;
  canUpload: boolean;
}) {
  return (
    <Pressable onPress={onPress}>
      <View
        borderRadius="$xl"
        alignItems="center"
        backgroundColor="$secondaryBackground"
        paddingVertical="$m"
        paddingHorizontal="$xl"
      >
        <Text fontSize="$l">
          {canUpload
            ? 'Tap here to change the cover image. Tap the icon to change the icon.'
            : 'You need to set up image hosting before you can upload'}
        </Text>
      </View>
    </Pressable>
  );
}

function GroupIconPressable({
  group,
  onPress,
  iconImage,
  uploading,
}: {
  uploading: boolean;
  group: db.Group;
  iconImage: string;
  onPress: () => void;
}) {
  if (uploading) {
    return (
      <View
        padding="$2xl"
        backgroundColor="$secondaryBackground"
        width={100}
        height={100}
        justifyContent="center"
        borderRadius="$2xl"
      >
        <LoadingSpinner size="large" />
      </View>
    );
  }

  return (
    <Pressable onPress={onPress}>
      <GroupAvatar
        model={{
          ...group,
          iconImage,
        }}
        ignoreCalm={true}
        size={'custom'}
        width={100}
        height={100}
        borderRadius="$xl"
      />
    </Pressable>
  );
}

export function GroupMetaScreenView({
  group,
  setGroupMetadata,
  deleteGroup,
  goBack,
  uploadInfo,
}: GroupMetaScreenViewProps) {
  const [showDeleteSheet, setShowDeleteSheet] = useState(false);
  const [showAttachmentSheet, setShowAttachmentSheet] = useState(false);
  const [attachingTo, setAttachingTo] = useState<null | 'cover' | 'icon'>(null);
  const {
    control,
    handleSubmit,
    formState: { errors },
    getValues,
    setValue,
  } = useForm({
    defaultValues: {
      title: group?.title ?? '',
      description: group?.description ?? '',
      coverImage: group?.coverImage ?? '',
      iconImage: group?.iconImage ?? '',
    },
  });

  const { coverImage, iconImage } = getValues();

  useEffect(() => {
    if (
      uploadInfo.imageAttachment &&
      uploadInfo.uploadedImage &&
      !uploadInfo.uploading &&
      uploadInfo.uploadedImage?.url !== '' &&
      attachingTo !== null
    ) {
      const uploadedFile = uploadInfo.uploadedImage as UploadedFile;

      setValue(
        attachingTo === 'cover' ? 'coverImage' : 'iconImage',
        uploadedFile.url
      );

      setAttachingTo(null);
      uploadInfo.resetImageAttachment();
    }
  }, [uploadInfo, attachingTo, setValue]);

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
    <View backgroundColor="$background" flex={1}>
      <YStack justifyContent="space-between" width="100%" height="100%">
        <GenericHeader
          title="Edit Group Info"
          goBack={goBack}
          rightContent={<SaveButton onPress={handleSubmit(onSubmit)} />}
        />
        <KeyboardAvoidingView>
          <YStack gap="$2xl" padding="$xl" alignItems="center" flex={1}>
            {uploadInfo.uploading && attachingTo === 'cover' ? (
              <View
                padding="$2xl"
                borderRadius="$2xl"
                width="100%"
                justifyContent="center"
                backgroundColor="$secondaryBackground"
                gap="$2xl"
                // accounting for height of the explanation pressable
                // and the group icon pressable, along with padding
                height={getTokenValue('$2xl', 'space') * 3 + 100 + 56.7}
              >
                <LoadingSpinner size="large" />
              </View>
            ) : coverImage ? (
              <View width="100%" borderRadius="$2xl" overflow="hidden">
                <ImageBackground
                  source={{ uri: coverImage }}
                  contentFit="cover"
                  style={{
                    width: '100%',
                    padding: getTokenValue('$2xl', 'space'),
                    gap: getTokenValue('$2xl', 'space'),
                    borderRadius: getTokenValue('$2xl', 'radius'),
                  }}
                >
                  <ExplanationPressable
                    onPress={() => {
                      if (uploadInfo.canUpload) {
                        setShowAttachmentSheet(true);
                        setAttachingTo('cover');
                      }
                    }}
                    canUpload={uploadInfo.canUpload}
                  />
                  <GroupIconPressable
                    group={group}
                    iconImage={iconImage}
                    onPress={() => {
                      if (uploadInfo.canUpload) {
                        setShowAttachmentSheet(true);
                        setAttachingTo('icon');
                      }
                    }}
                    uploading={uploadInfo.uploading && attachingTo === 'icon'}
                  />
                </ImageBackground>
              </View>
            ) : (
              <YStack
                padding="$2xl"
                borderRadius="$2xl"
                width="100%"
                backgroundColor="$secondaryBackground"
                gap="$2xl"
              >
                <ExplanationPressable
                  onPress={() => {
                    if (uploadInfo.canUpload) {
                      setShowAttachmentSheet(true);
                      setAttachingTo('cover');
                    }
                  }}
                  canUpload={uploadInfo.canUpload}
                />
                <GroupIconPressable
                  group={group}
                  iconImage={iconImage}
                  onPress={() => {
                    if (uploadInfo.canUpload) {
                      setShowAttachmentSheet(true);
                      setAttachingTo('icon');
                    }
                  }}
                  uploading={uploadInfo.uploading && attachingTo === 'icon'}
                />
              </YStack>
            )}
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
              <Button heroDestructive onPress={() => setShowDeleteSheet(true)}>
                <Button.Text>Delete group for everyone</Button.Text>
              </Button>
            </YStack>
          </YStack>
        </KeyboardAvoidingView>
      </YStack>
      <AttachmentSheet
        showAttachmentSheet={showAttachmentSheet}
        setShowAttachmentSheet={setShowAttachmentSheet}
        setImage={(attachments: MessageAttachments) => {
          uploadInfo.setAttachments(attachments);
        }}
      />
      <DeleteSheet
        title={group.title ?? 'This Group'}
        itemTypeDescription="group"
        open={showDeleteSheet}
        onOpenChange={setShowDeleteSheet}
        deleteAction={deleteGroup}
      />
    </View>
  );
}
