import React, { ComponentProps, useMemo } from 'react';
import FastImage from 'react-native-fast-image';
import { SvgUri } from 'react-native-svg';
import { styled } from 'tamagui';

const StyledFastImage = styled(FastImage, { name: 'FastImage' });
const StyledSvgUri = styled(SvgUri, { name: 'Svg' });

export const Image = React.forwardRef(function (
  // TODO: Add support for fallback and onLoad, props are only slightly different
  props: Omit<ComponentProps<typeof StyledFastImage>, 'fallback' | 'onLoad'>,
  ref
) {
  const url = useMemo(() => {
    return typeof props.source === 'string'
      ? props.source
      : typeof props.source === 'object'
        ? props.source?.uri
        : undefined;
  }, [props.source]);
  if (url && url.endsWith('svg')) {
    return <StyledSvgUri {...props} uri={url} ref={ref} />;
  }
  return <StyledFastImage {...props} ref={ref} />;
});
