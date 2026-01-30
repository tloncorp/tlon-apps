import { useMemo } from 'react';

import FileAttachmentIcon from '../assets/file_attachment.svg';
import { ForwardingProps } from '../utils';
import { Text } from './TextV2';
import { View } from './View';

// pixel-perfect height taken from `file_attachment.svg`
const iconSize = 47;

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
        <View
          style={{
            // `file_attachment.svg` has internal shadow, but it doesn't appear to work on iOS.
            // Adding a shadow here to match the design more closely.
            shadowColor: '#000',
            shadowOffset: { width: 0 * scale, height: 0.68 * scale },
            shadowOpacity: 0.25,
            shadowRadius: 1.37 * scale,
          }}
        >
          <FileAttachmentIcon
            height={iconSize * scale}
            width={iconSize * scale}
          />
        </View>
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
      return (
        opts.filename?.split('.').at(-1) ?? opts.uri?.split('.').at(-1) ?? null
      );
  }
};
