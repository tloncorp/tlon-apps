import { createDevLogger } from '@tloncorp/shared';
import { Image as BaseImage, ImageErrorEventData } from 'expo-image';
import { ReactElement, useCallback, useMemo, useState } from 'react';
import { SizableText, View, styled } from 'tamagui';
import isURL from 'validator/es/lib/isURL';

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

    const showFallback = useMemo(() => {
      const isValid = isValidImageSource(props.source);
      return !isValid || hasErrored;
    }, [props.source, hasErrored]);

    if (showFallback && fallback) {
      return fallback;
    }

    if (showFallback) {
      return <DefaultImageFallback />;
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
      // this is the case for imports of bundled files (require returns a numeric module ID)
      return true;
    }

    return isURL(uri, { protocols: ['http', 'https', 'data', 'file'] });
  } catch (e) {
    logger.trackError('Failed to validate image source', {
      source,
      errorMessage: e.message,
      errorStack: e.stack,
    });
  }
  return false;
}
