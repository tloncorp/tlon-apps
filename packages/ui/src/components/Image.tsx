import { PLACEHOLDER_ASSET_URI } from '@tloncorp/shared';
import { Image as BaseImage, ImageErrorEventData } from 'expo-image';
import { ReactElement, useCallback, useMemo, useState } from 'react';
import { SizableText, View, styled } from 'tamagui';

import { ErrorBoundary } from './ErrorBoundary';
import { Icon } from './Icon';
import { isValidImageSource } from './imageSource';

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
  fallback?: ReactElement | null;
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

    const parsedSource = useMemo(
      () => ({
        isPlaceholder: isPlaceholderAsset(props.source),
        isInvalid: !isValidImageSource(props.source),
      }),
      [props.source]
    );

    if (parsedSource.isPlaceholder) {
      return null;
    }

    if (parsedSource.isInvalid || hasErrored) {
      return fallback === undefined ? <DefaultImageFallback /> : fallback;
    }

    return (
      <ErrorBoundary
        fallback={fallback === undefined ? <DefaultImageFallback /> : fallback}
      >
        <StyledBaseImage ref={ref} {...props} onError={handleError} />
      </ErrorBoundary>
    );
  },
  {
    staticConfig: {
      componentName: 'Image',
    },
  }
);

function isPlaceholderAsset(source: any) {
  return (
    source != null &&
    typeof source === 'object' &&
    source.uri === PLACEHOLDER_ASSET_URI
  );
}
