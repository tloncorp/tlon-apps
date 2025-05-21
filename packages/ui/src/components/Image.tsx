import { Image as BaseImage, ImageErrorEventData } from 'expo-image';
import { ReactElement, useCallback, useState } from 'react';
import { SizableText, View, styled } from 'tamagui';

import { Icon } from './Icon';

const DefaultImageFallback = View.styleable((props, ref) => {
  return (
    <View
      flex={1}
      alignItems="center"
      justifyContent="center"
      ref={ref}
      minHeight={200}
      minWidth={200}
      backgroundColor="$secondaryBackground"
      borderRadius="$m"
      {...props}
    >
      <Icon type="Placeholder" color="$tertiaryText" />
      <SizableText color="$tertiaryText">Unable to load image</SizableText>
    </View>
  );
});

const StyledBaseImage = styled(BaseImage, { name: 'StyledExpoImage' });

export const Image = StyledBaseImage.styleable<{
  fallback?: ReactElement;
}>(
  ({ fallback, onError, ...props }, ref) => {
    const [hasErrored, setHasErrored] = useState(false);
    const handleError = useCallback(
      (e: ImageErrorEventData) => {
        setHasErrored(true);
        onError?.(e);
      },
      [onError]
    );

    if (hasErrored && fallback) {
      return fallback;
    }

    if (hasErrored) {
      return <DefaultImageFallback />;
    }

    return <StyledBaseImage ref={ref} {...props} onError={handleError} />;
  },
  {
    staticConfig: {
      componentName: 'Image',
    },
  }
);
