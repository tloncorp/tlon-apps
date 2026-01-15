import { useMemo } from 'react';

import FileAttachmentIcon from '../assets/file_attachment.svg';
import { ForwardingProps } from '../utils';
import { Text } from './TextV2';
import { View } from './View';

export function FilePreview({
  fileExtensionLabel,
  ...passedProps
}: ForwardingProps<
  typeof View,
  {
    fileExtensionLabel?: string;
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

  return (
    // use one wrapper view so we can safely use position="relative" on the inner one
    <View {...passedProps}>
      <View position="relative">
        <FileAttachmentIcon
          // This height is from the SVG.
          height={47}
          // We want to use the intrinsic height, but make the width
          // squared to the height.
          width={47}
        />
        {formattedFileExtensionLabel && (
          <Text
            position="absolute"
            bottom={8}
            left="50%"
            transform={[{ translateX: '-50%' }]}
            fontSize={10}
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
