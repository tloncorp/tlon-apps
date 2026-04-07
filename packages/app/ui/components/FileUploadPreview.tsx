import { formatMemorySize } from '@tloncorp/shared/utils';
import {
  FilePreview,
  ForwardingProps,
  Icon,
  Pressable,
  Text,
  View,
} from '@tloncorp/ui';
import React, { ComponentProps, useMemo, useState } from 'react';
import { LayoutRectangle } from 'react-native';
import { XStack, YStack } from 'tamagui';

import { useNavigation } from '../contexts/navigation';
import { Reference } from './ContentReference';
import { BlockquoteSideBorder } from './PostContent/BlockquoteSideBorder';

function FileNameLabel({
  file,
  ...passed
}: Pick<ComponentProps<typeof Text>, 'size' | 'numberOfLines' | 'textAlign'> & {
  file: { name?: string };
}) {
  return (
    <Text
      size="$label/xl"
      ellipsizeMode={passed.numberOfLines === 1 ? 'middle' : 'tail'}
      flexShrink={0}
      {...passed}
    >
      {file.name}
    </Text>
  );
}

function FileSizeLabel({
  file,
  ...passed
}: Pick<ComponentProps<typeof Text>, 'size'> & {
  file: { size: number };
}) {
  const formattedSize = useMemo(() => formatMemorySize(file.size), [file.size]);
  return (
    <Text size="$label/m" color="$secondaryText" {...passed}>
      {formattedSize}
    </Text>
  );
}

export function FileUploadPreview({
  file,
  fullbleed = false,
  ...passedProps
}: ForwardingProps<
  typeof View,
  {
    file: {
      fileUri?: string;
      mimeType?: string;
      name?: string;
      /** in bytes */
      size: number;
    };
    fullbleed?: boolean;
  }
>) {
  const { openExternalLink } = useNavigation();
  const isUploading = useMemo(
    () =>
      file.fileUri == null ||
      file.fileUri.startsWith('file://') ||
      file.fileUri.startsWith('blob:'),
    [file.fileUri]
  );

  const fileTypeCode = useMemo(
    () =>
      FilePreview.fileExtensionFrom({
        filename: file.name,
        mimeType: file.mimeType,
        uri: file.fileUri,
      }),
    [file]
  );

  const navigateToFile = useMemo(() => {
    if (file.fileUri == null) return undefined;
    return () => {
      file.fileUri && openExternalLink(file.fileUri);
    };
  }, [file.fileUri, openExternalLink]);

  if (isUploading) {
    return (
      <YStack paddingLeft="$l" {...passedProps}>
        <BlockquoteSideBorder />
        <Text color="$tertiaryText">Uploading attachment...</Text>
      </YStack>
    );
  }

  if (fullbleed) {
    return <FileUploadLockup file={file} {...passedProps} />;
  }

  return (
    <Reference.Frame
      disabled={navigateToFile == null}
      onPress={navigateToFile}
      {...passedProps}
    >
      <Reference.Header>
        <Reference.Title>
          <Icon
            type="ChannelNote"
            color="$tertiaryText"
            customSize={['$l', '$l']}
          />
          <Reference.TitleText>File Upload</Reference.TitleText>
        </Reference.Title>
        <Reference.ActionIcon />
      </Reference.Header>
      <Reference.Body>
        <XStack padding="$l" gap="$m">
          <FilePreview
            fileExtensionLabel={fileTypeCode ?? undefined}
            size="m"
          />
          <YStack gap="$xl" flex={1} justifyContent="center">
            <FileNameLabel file={file} numberOfLines={1} />
            <FileSizeLabel file={file} />
          </YStack>
        </XStack>
      </Reference.Body>
    </Reference.Frame>
  );
}

export function FileUploadLockup({
  file,
  ...passedProps
}: ForwardingProps<
  typeof Pressable,
  {
    file: {
      fileUri?: string;
      mimeType?: string;
      name?: string;
      /** in bytes */
      size: number;
    };
  }
>) {
  const { openExternalLink } = useNavigation();
  const fileTypeCode = useMemo(
    () =>
      FilePreview.fileExtensionFrom({
        filename: file.name,
        mimeType: file.mimeType,
        uri: file.fileUri,
      }),
    [file]
  );
  const navigateToFile = useMemo(() => {
    if (file.fileUri == null) return undefined;
    return () => {
      file.fileUri && openExternalLink(file.fileUri);
    };
  }, [file.fileUri, openExternalLink]);
  const [containerLayout, setContainerLayout] =
    useState<LayoutRectangle | null>(null);
  // arbitrary number breakpoints for adjusting layout based on container height
  // (smaller value => more compact layout)
  const containerHeightBreakpoint = useMemo(() => {
    const MEDIUM_HEIGHT = 70;
    const LARGE_HEIGHT = 100;
    return containerLayout == null
      ? null
      : containerLayout.height < MEDIUM_HEIGHT
        ? 1
        : containerLayout.height < LARGE_HEIGHT
          ? 2
          : 3;
  }, [containerLayout]);

  return (
    <Pressable
      onLayout={(event) => setContainerLayout(event.nativeEvent.layout)}
      alignItems="center"
      justifyContent="center"
      gap="$s"
      padding="$2xs"
      flex={1}
      flexDirection="column"
      disabled={navigateToFile == null}
      onPress={navigateToFile}
      {...passedProps}
    >
      <FilePreview
        // hide preview if we haven't measured the container yet to avoid flash of incorrect sizing
        opacity={containerHeightBreakpoint == null ? 0 : 1}
        fileExtensionLabel={fileTypeCode ?? undefined}
        size={(containerHeightBreakpoint ?? Infinity) < 2 ? 's' : 'm'}
      />
      <FileNameLabel
        file={file}
        numberOfLines={1}
        size="$label/m"
        textAlign="center"
      />
      {(containerHeightBreakpoint ?? Infinity) > 1 && (
        <FileSizeLabel file={file} size="$label/s" />
      )}
    </Pressable>
  );
}
