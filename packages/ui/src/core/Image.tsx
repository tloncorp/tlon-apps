import { Image as BaseImage, ImageErrorEventData } from 'expo-image';
import { ReactElement, useCallback, useState } from 'react';
import { Platform } from 'react-native';
import { GetProps, styled } from 'tamagui';

type TamaguiImageProps = GetProps<typeof StyledImage>;

// this is necessary for web to avoid CORS issues.
// we have to add crossOrigin="anonymous" to the image tag
// because the image is loaded from a different domain and that isn't allowed
// by default because we're now serving wasm files from the server.
const addCrossOriginProp = (props: TamaguiImageProps) => {
  if (Platform.OS === 'web') {
    return { ...props, crossOrigin: 'anonymous' };
  }
  return props;
};

const StyledImage = styled(BaseImage, {
  name: 'StyledExpoImage',
});

export const Image = (props: GetProps<typeof StyledImage>) => {
  const imageProps = addCrossOriginProp(props);
  return <StyledImage {...imageProps} />;
};

export const ImageWithFallback = StyledImage.styleable<{
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

    const imageProps = addCrossOriginProp(props);

    return hasErrored ? (
      fallback
    ) : (
      <StyledImage ref={ref} {...imageProps} onError={handleError} />
    );
  },
  {
    staticConfig: {
      componentName: 'ImageWithFallback',
    },
  }
);
