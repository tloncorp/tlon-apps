import { Image as BaseImage, ImageErrorEventData } from 'expo-image';
import { ReactElement, useCallback, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { styled } from 'tamagui';

const WebImage = ({ source, style, alt, onLoad, ...props }: any) => {
  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (onLoad) {
      // Mimic expo-image's onLoad event structure
      onLoad({
        source: {
          width: e.currentTarget.naturalWidth,
          height: e.currentTarget.naturalHeight,
        },
      });
    }
  };

  const { contentFit  } = props;

  return (
    <img
      src={source.uri}
      alt={alt}
      style={{
        ...StyleSheet.flatten(style),
        maxWidth: '100%',
        height: props.height ? props.height : '100%',
        objectFit: contentFit ? contentFit : undefined,
      }}
      onLoad={handleLoad}
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

    return hasErrored ? (
      fallback
    ) : (
      <StyledBaseImage ref={ref} {...props} onError={handleError} />
    );
  },
  {
    staticConfig: {
      componentName: 'ImageWithFallback',
    },
  }
);
