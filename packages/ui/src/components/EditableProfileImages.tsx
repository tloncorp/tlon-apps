import * as api from '@tloncorp/shared/dist/api';
import * as db from '@tloncorp/shared/dist/db';
import { ImageBackground } from 'expo-image';
import {
  ComponentProps,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { TouchableOpacity } from 'react-native';
import { Circle, Stack, ZStack, useTheme } from 'tamagui';

import { View } from '../core';
import AttachmentSheet from './AttachmentSheet';
import { AvatarProps, ContactAvatar, GroupAvatar } from './Avatar';
import { Icon } from './Icon';
import { LoadingSpinner } from './LoadingSpinner';

interface Props {
  contact?: db.Contact;
  group?: db.Group;
  iconProps?: AvatarProps;
  uploadInfo: api.UploadInfo;
  onSetCoverUrl: (url: string) => void;
  onSetIconUrl: (url: string) => void;
}

export function EditablePofileImages(props: Props) {
  const theme = useTheme();
  const [showAttachmentSheet, setShowAttachmentSheet] = useState(false);
  const [attachingTo, setAttachingTo] = useState<null | 'cover' | 'icon'>(null);
  const [iconUrl, setIconUrl] = useState(
    props.contact?.avatarImage ?? props.group?.iconImage ?? ''
  );
  const [coverUrl, setCoverUrl] = useState(
    props.contact?.coverImage ?? props.group?.coverImage ?? ''
  );

  useEffect(() => {
    if (
      props.uploadInfo.imageAttachment &&
      props.uploadInfo.uploadedImage &&
      !props.uploadInfo.uploading &&
      props.uploadInfo.uploadedImage?.url !== '' &&
      props.uploadInfo !== null
    ) {
      const uploadedFile = props.uploadInfo.uploadedImage as api.UploadedFile;
      if (attachingTo === 'cover') {
        setCoverUrl(uploadedFile.url);
        props.onSetCoverUrl(uploadedFile.url);
      } else if (attachingTo === 'icon') {
        setIconUrl(uploadedFile.url);
        props.onSetIconUrl(uploadedFile.url);
      }

      setAttachingTo(null);
      props.uploadInfo.resetImageAttachment();
    }
  }, [props.uploadInfo, attachingTo, props]);

  const coverIsUploading = useMemo(() => {
    return props.uploadInfo.uploading && attachingTo === 'cover';
  }, [attachingTo, props.uploadInfo.uploading]);

  const iconIsUploading = useMemo(() => {
    return props.uploadInfo.uploading && attachingTo === 'icon';
  }, [attachingTo, props.uploadInfo.uploading]);

  const handleCoverPress = useCallback(() => {
    if (props.uploadInfo.canUpload) {
      setShowAttachmentSheet(true);
      setAttachingTo('cover');
    }
  }, [props.uploadInfo]);

  const handleIconPress = useCallback(() => {
    if (props.uploadInfo.canUpload) {
      setShowAttachmentSheet(true);
      setAttachingTo('icon');
    }
  }, [props.uploadInfo]);

  return (
    <View width="100%" height={164} borderRadius="$xl" overflow="hidden">
      <ZStack width="100%" height="100%">
        {/* Cover Image */}
        <TouchableOpacity
          style={{ width: '100%', height: '100%' }}
          activeOpacity={0.85}
          onPress={handleCoverPress}
          disabled={!props.uploadInfo.canUpload}
        >
          <ImageBackground
            source={{ uri: coverUrl }}
            contentFit="cover"
            style={{
              width: '100%',
              height: '100%',
              justifyContent: 'flex-end',
              alignItems: 'flex-end',
              backgroundColor: theme.secondaryBackground.val,
              opacity: coverIsUploading ? 0.7 : 1,
            }}
          >
            {coverIsUploading && (
              <Stack
                flex={1}
                width="100%"
                justifyContent="center"
                alignItems="center"
              >
                <LoadingSpinner size="small" color="white" />
              </Stack>
            )}
            <EditableImageIndicator
              position="absolute"
              bottom="$l"
              right="$l"
              opacity={!props.uploadInfo.canUpload ? 0 : 1}
              loading={coverIsUploading}
            />
          </ImageBackground>
        </TouchableOpacity>

        {/* Profile Icon */}
        <View
          position="absolute"
          top={34}
          left="$2xl"
          opacity={iconIsUploading ? 0.7 : 1}
        >
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleIconPress}
            disabled={!props.uploadInfo.canUpload}
          >
            {props.contact && (
              <ContactAvatar
                contactId={props.contact.id}
                overrideUrl={iconUrl}
                size="$9xl"
                {...props.iconProps}
              />
            )}
            {props.group && (
              <GroupAvatar
                model={{ ...props.group, iconImage: iconUrl }}
                size="$9xl"
                {...props.iconProps}
              />
            )}
            <EditableImageIndicator
              position="absolute"
              bottom="$s"
              right="$s"
              opacity={!props.uploadInfo.canUpload ? 0 : 1}
              loading={iconIsUploading}
            />
          </TouchableOpacity>
        </View>
      </ZStack>

      <AttachmentSheet
        showAttachmentSheet={showAttachmentSheet}
        setShowAttachmentSheet={setShowAttachmentSheet}
        setImage={(attachments: api.MessageAttachments) => {
          props.uploadInfo.setAttachments(attachments);
        }}
      />
    </View>
  );
}

export function EditableImageIndicator(
  props: ComponentProps<typeof Circle> & { loading?: boolean }
) {
  return (
    <Circle
      backgroundColor="$black"
      opacity={props.loading ? 0 : 0.7}
      padding="$m"
      {...props}
    >
      <Icon type="Camera" color="$white" size="$s" />
    </Circle>
  );
}
