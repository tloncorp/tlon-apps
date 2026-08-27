import { useMemo } from 'react';

import fileAttachmentPng from '../assets/file_attachment.png';
import { ForwardingProps } from '../utils';
import { Image } from './Image';
import { Text } from './TextV2';
import { View } from './View';

// this won't visually match the width of the icon because:
// - we're using a raster with a baked-in shadow (Android doesn't like SVG shadows)
// - the shadow is asymmetrical (wider on the right due to page curl)
// - we want to center the icon, so the raster has extra padding on the left to center
const ICON_CONTAINER_BASE_WIDTH = 47;

export function FilePreview({
  fileExtensionLabel,
  size,
  ...passedProps
}: ForwardingProps<
  typeof View,
  {
    fileExtensionLabel?: string;
    size?: 'm' | 's';
  }
>) {
  const formattedFileExtensionLabel = useMemo(() => {
    if (fileExtensionLabel == null) {
      return null;
    }
    if (fileExtensionLabel.length > 4) {
      return null;
    }
    return fileExtensionLabel.toUpperCase();
  }, [fileExtensionLabel]);

  const scale = size === 's' ? 0.75 : 1;

  return (
    // use one wrapper view so we can safely use position="relative" on the inner one
    <View {...passedProps}>
      <View position="relative">
        <Image
          source={fileAttachmentPng}
          width={ICON_CONTAINER_BASE_WIDTH * scale}
          aspectRatio={1}
          style={{
            resizeMode: 'contain',
          }}
        />
        {formattedFileExtensionLabel && (
          <Text
            position="absolute"
            bottom={8 * scale}
            alignSelf="center"
            fontSize={10 * scale}
            fontWeight={'500'}
            letterSpacing={-0.5}
            color="$tertiaryText"
            style={{ userSelect: 'none' }}
          >
            {formattedFileExtensionLabel}
          </Text>
        )}
      </View>
    </View>
  );
}

FilePreview.fileExtensionFrom = (opts: {
  uri?: string;
  filename?: string;
  mimeType?: string;
}): string | null => {
  switch (opts.mimeType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'application/pdf':
      return 'pdf';
    case 'text/plain':
      return 'txt';
    case 'application/zip':
      return 'zip';
    case 'video/mp4':
      return 'mp4';
    default:
      return extensionOf(opts.filename) ?? extensionOf(opts.uri) ?? null;
  }
};

function extensionOf(name?: string): string | null {
  if (name == null) {
    return null;
  }
  const segments = name.split('.');
  // without a dot there is no extension; the old `.at(-1)` fallback returned
  // the entire string (e.g. a full URL) as the "extension"
  return segments.length > 1 ? (segments.at(-1) ?? null) : null;
}
