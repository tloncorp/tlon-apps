import * as api from '@tloncorp/shared/dist/api';
import * as db from '@tloncorp/shared/dist/db';
import { ImageBackground } from 'expo-image';
import { ImagePickerAsset } from 'expo-image-picker';
import {
  ComponentProps,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { TouchableOpacity } from 'react-native';
import { Circle, Stack, ZStack, useTheme } from 'tamagui';
import { View } from 'tamagui';

import {
  useAttachmentContext,
  useMappedImageAttachments,
} from '../contexts/attachment';
import AttachmentSheet from './AttachmentSheet';
import {
  AvatarProps,
  ChannelAvatar,
  ContactAvatar,
  GroupAvatar,
} from './Avatar';
import { Icon } from './Icon';
import { LoadingSpinner } from './LoadingSpinner';

interface Props {
  contact?: db.Contact | null;
  group?: db.Group | null;
  channel?: db.Channel | null;
  iconProps?: AvatarProps;
  uploadInfo?: api.UploadInfo;
  onSetCoverUrl: (url: string) => void;
  onSetIconUrl: (url: string) => void;
}

export function EditablePofileImages({
  onSetCoverUrl,
  onSetIconUrl,
  ...props
}: Props) {
  const theme = useTheme();
  const [showAttachmentSheet, setShowAttachmentSheet] = useState(false);
  const [attachingTo, setAttachingTo] = useState<null | 'cover' | 'icon'>(null);
  const [localIconUrl, setLocalIconUrl] = useState(
    props.contact?.avatarImage ??
      props.group?.iconImage ??
      props.channel?.iconImage ??
      ''
  );
  const [localCoverUrl, setLocalCoverUrl] = useState(
    props.contact?.coverImage ??
      props.group?.coverImage ??
      props.channel?.coverImage ??
      ''
  );
  const { attachAssets, canUpload } = useAttachmentContext();
  const { coverAttachment, iconAttachment } = useMappedImageAttachments({
    coverAttachment: localCoverUrl,
    iconAttachment: localIconUrl,
  });
  const remoteCoverUrl =
    coverAttachment?.uploadState?.status === 'success'
      ? coverAttachment.uploadState.remoteUri
      : null;
  const remoteIconUrl =
    iconAttachment?.uploadState?.status === 'success'
      ? iconAttachment.uploadState.remoteUri
      : null;

  useEffect(() => {
    if (remoteCoverUrl) {
      onSetCoverUrl(remoteCoverUrl);
    }
  }, [remoteCoverUrl, onSetCoverUrl]);

  useEffect(() => {
    if (remoteIconUrl) {
      onSetIconUrl(remoteIconUrl);
    }
  }, [remoteIconUrl, onSetIconUrl]);

  const coverIsUploading = useMemo(() => {
    return coverAttachment?.uploadState?.status === 'uploading';
  }, [coverAttachment]);

  const iconIsUploading = useMemo(() => {
    return iconAttachment?.uploadState?.status === 'uploading';
  }, [iconAttachment]);

  const handleCoverPress = useCallback(() => {
    setShowAttachmentSheet(true);
    setAttachingTo('cover');
  }, []);

  const handleIconPress = useCallback(() => {
    setShowAttachmentSheet(true);
    setAttachingTo('icon');
  }, []);

  const handleAssetsSelected = useCallback(
    (assets: ImagePickerAsset[]) => {
      if (attachingTo === 'cover') {
        attachAssets([assets[0]]);
        setLocalCoverUrl(assets[0].uri);
      } else if (attachingTo === 'icon') {
        attachAssets([assets[0]]);
        setLocalIconUrl(assets[0].uri);
      }
    },
    [attachingTo, attachAssets]
  );

  const handleAttachmentCleared = useCallback(() => {
    if (attachingTo === 'cover') {
      setLocalCoverUrl('');
      onSetCoverUrl('');
    } else if (attachingTo === 'icon') {
      setLocalIconUrl('');
      onSetIconUrl('');
    }
  }, [attachingTo, onSetCoverUrl, onSetIconUrl]);

  return (
    <View width="100%" height={164} borderRadius="$xl" overflow="hidden">
      <ZStack width="100%" height="100%">
        {/* Cover Image */}
        <TouchableOpacity
          style={{ width: '100%', height: '100%' }}
          activeOpacity={0.85}
          onPress={handleCoverPress}
          disabled={!canUpload}
        >
          <View
            width="100%"
            height="100%"
            justifyContent="flex-end"
            alignItems="flex-end"
            backgroundColor={theme.secondaryBackground.val}
          >
            {localCoverUrl ? (
              <ImageBackground
                source={{ uri: localCoverUrl }}
                contentFit="cover"
                style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  opacity: coverIsUploading ? 0.7 : 1,
                }}
              />
            ) : null}

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
              opacity={!canUpload ? 0 : 1}
              loading={coverIsUploading}
            />
          </View>
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
            disabled={!canUpload}
          >
            {props.contact && (
              <ContactAvatar
                contactId={props.contact.id}
                overrideUrl={localIconUrl}
                size="$9xl"
                {...props.iconProps}
              />
            )}
            {props.group && (
              <GroupAvatar
                model={{ ...props.group, iconImage: localIconUrl }}
                size="$9xl"
                {...props.iconProps}
              />
            )}
            {props.channel && (
              <ChannelAvatar model={props.channel} size="$9xl" />
            )}
            <EditableImageIndicator
              position="absolute"
              bottom="$s"
              right="$s"
              opacity={!canUpload ? 0 : 1}
              loading={iconIsUploading}
            />
          </TouchableOpacity>
        </View>
      </ZStack>

      <AttachmentSheet
        isOpen={showAttachmentSheet}
        onOpenChange={setShowAttachmentSheet}
        onAttachmentsSet={handleAssetsSelected}
        showClearOption={
          (attachingTo === 'cover' && localCoverUrl !== '') ||
          (attachingTo === 'icon' && localIconUrl !== '')
        }
        onClearAttachments={handleAttachmentCleared}
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
