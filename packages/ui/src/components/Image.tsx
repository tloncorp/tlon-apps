import { PLACEHOLDER_ASSET_URI, createDevLogger } from '@tloncorp/shared';
import { Image as BaseImage, ImageErrorEventData } from 'expo-image';
import { ReactElement, useCallback, useMemo, useState } from 'react';
import { SizableText, View, styled } from 'tamagui';
import { isDataURI, isURL } from 'validator';

import { ErrorBoundary } from './ErrorBoundary';
import { Icon } from './Icon';

const logger = createDevLogger('Image', false);

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
      return fallback ?? <DefaultImageFallback />;
    }

    return (
      <ErrorBoundary fallback={fallback ?? <DefaultImageFallback />}>
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

function isValidImageSource(source: any) {
  try {
    if (!source) return false;
    const uri: string = typeof source === 'object' ? source.uri : source;
    if (!uri) {
      return false;
    }

    if (typeof uri === 'number') {
      // this is the case for imports of bundled files (require() returns a numeric metro module ID)
      return true;
    }

    if (
      typeof uri === 'string' &&
      (uri.startsWith('file:') || uri.startsWith('blob:'))
    ) {
      // permit file URIs
      return true;
    }

    return isURL(uri) || isDataURI(uri);
  } catch (e) {
    logger.trackError('Failed to validate image source', {
      source,
      errorMessage: e.message,
      errorStack: e.stack,
    });
  }
  return false;
}

function isPlaceholderAsset(source: any) {
  return typeof source === 'object' && source.uri === PLACEHOLDER_ASSET_URI;
}
