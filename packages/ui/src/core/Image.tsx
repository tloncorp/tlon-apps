import { Image as BaseImage, ImageErrorEventData } from 'expo-image';
import { ReactElement, useCallback, useState } from 'react';
import { styled } from 'tamagui';

export const Image = styled(BaseImage, { name: 'StyledExpoImage' });

export const ImageWithFallback = Image.styleable<{
  fallback: ReactElement;
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

    return hasErrored ? (
      fallback
    ) : (
      <Image ref={ref} {...props} onError={handleError} />
    );
  },
  {
    staticConfig: {
      componentName: 'ImageWithFallback',
    },
  }
);
