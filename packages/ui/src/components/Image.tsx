import { Image as BaseImage, ImageErrorEventData } from 'expo-image';
import { ReactElement, useCallback, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { SizableText, View, styled, usePropsAndStyle } from 'tamagui';

import { Icon } from './Icon';

const DefaultImageFallback = () => (
  <View flex={1} alignItems="center" justifyContent="center">
    <Icon type="Placeholder" color="$tertiaryText" />
    <SizableText color="$tertiaryText">Unable to load image</SizableText>
  </View>
);

const WebImage = ({
  source,
  style,
  alt,
  onLoad,
  onLoadEnd,
  onError,
  fallback,
  ...otherProps
}: any) => {
  const [hasError, setHasError] = useState(false);

  const handleError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setHasError(true);
    if (onError) {
      onError({
        error: new Error('Image loading failed'),
        target: e.currentTarget,
      });
    }
  };

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    // Mimic expo-image's onLoad event structure
    const loadEvent = {
      source: {
        width: e.currentTarget.naturalWidth,
        height: e.currentTarget.naturalHeight,
      },
    };
    onLoad?.(loadEvent);
    onLoadEnd?.(loadEvent);
  };

  const [{ contentFit, ...props }, propStyles] = usePropsAndStyle(otherProps);

  if (hasError && fallback) {
    return fallback;
  }

  if (hasError) {
    return <DefaultImageFallback />;
  }

  return (
    <img
      src={source.uri}
      alt={alt}
      style={{
        maxWidth: '100%',
        height: props.height ? props.height : '100%',
        objectFit: contentFit ? contentFit : undefined,
        ...StyleSheet.flatten(style),
        ...propStyles,
      }}
      onLoad={handleLoad}
      onError={handleError}
      {...props}
    />
  );
};

const StyledBaseImage = styled(BaseImage, { name: 'StyledExpoImage' });

export const Image = Platform.OS === 'web' ? WebImage : StyledBaseImage;

export const ImageWithFallback = StyledBaseImage.styleable<{
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
      componentName: 'ImageWithFallback',
    },
  }
);
