import { Icon, Text } from '@tloncorp/ui';
import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { View, YStack } from 'tamagui';

import {
  BucketUploadCandidate,
  BucketsDropTargetComponent,
} from './BucketsDropTarget.types';

export const BucketsDropTarget: BucketsDropTargetComponent = ({
  children,
  disabled,
  dropLabel,
  onFilesDropped,
  ...props
}) => {
  const handleDrop = useCallback(
    (files: File[]) => {
      const candidates: BucketUploadCandidate[] = files.map((file) => ({
        mimeType: file.type || undefined,
        name: file.name,
        size: file.size,
      }));
      if (candidates.length > 0) {
        onFilesDropped?.(candidates);
      }
    },
    [onFilesDropped]
  );
  const { getInputProps, getRootProps, isDragActive, isDragReject } =
    useDropzone({
      disabled: disabled || !onFilesDropped,
      noClick: true,
      noKeyboard: true,
      onDrop: handleDrop,
    });

  return (
    // @ts-expect-error getRootProps() supplies web-only drag event props.
    <View {...getRootProps()} {...props}>
      {/* @ts-expect-error this hidden input exists only in the web build. */}
      <View
        {...getInputProps()}
        render="input"
        width={0}
        height={0}
        position="absolute"
      />
      {children}
      {isDragActive ? (
        <YStack
          position="absolute"
          top="$m"
          right="$m"
          bottom="$m"
          left="$m"
          zIndex={100}
          alignItems="center"
          justifyContent="center"
          gap="$m"
          borderColor={isDragReject ? '$negativeBorder' : '$border'}
          borderRadius="$2xl"
          borderStyle="dashed"
          borderWidth={2}
          backgroundColor="$background"
          opacity={0.97}
          pointerEvents="none"
        >
          <YStack
            width="$5xl"
            height="$5xl"
            alignItems="center"
            justifyContent="center"
            borderRadius="$xl"
            backgroundColor={
              isDragReject ? '$negativeBackground' : '$secondaryBackground'
            }
          >
            <Icon
              color={
                isDragReject ? '$negativeActionText' : '$positiveActionText'
              }
              size="$xl"
              type="Attachment"
            />
          </YStack>
          <YStack alignItems="center" gap="$xs" paddingHorizontal="$2xl">
            <Text color="$primaryText" size="$label/xl" textAlign="center">
              {isDragReject
                ? 'These files cannot be uploaded'
                : 'Drop to upload'}
            </Text>
            <Text color="$secondaryText" size="$label/m" textAlign="center">
              {isDragReject
                ? 'Try a different file.'
                : `Files will be added to ${dropLabel}.`}
            </Text>
          </YStack>
        </YStack>
      ) : null}
    </View>
  );
};
