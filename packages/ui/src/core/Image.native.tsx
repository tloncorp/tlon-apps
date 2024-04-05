import React, { ComponentProps, useMemo } from 'react';
import FastImage from 'react-native-fast-image';
import { SvgUri } from 'react-native-svg';
import { TamaguiElement, styled } from 'tamagui';

import { View } from './tamagui';

const StyledFastImage = styled(FastImage, { name: 'FastImage' });

export const Image = React.forwardRef<TamaguiElement>(function (
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

  const isSvg = useMemo(() => {
    return url && new URL(url).pathname.endsWith('svg');
  }, [url]);

  if (url && isSvg) {
    return (
      <View {...props} ref={ref}>
        <SvgUri uri={url} width={'100%'} height={'100%'} />
      </View>
    );
  }
  return <StyledFastImage {...props} ref={ref} />;
});
