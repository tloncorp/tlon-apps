import React, { ComponentProps, useEffect, useMemo, useState } from 'react';
import FastImage from 'react-native-fast-image';
import { SvgXml } from 'react-native-svg';
import { TamaguiElement, styled } from 'tamagui';

import { storage } from '../utils';
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
    return <SvgImage {...props} source={url} ref={ref} />;
  } else {
    return <StyledFastImage {...props} ref={ref} />;
  }
});

export const SvgImage = React.forwardRef<TamaguiElement, { source: string }>(
  (
    {
      source,
      ...props
    }: { source: string } & Omit<
      ComponentProps<typeof StyledFastImage>,
      'fallback' | 'onLoad'
    >,
    ref
  ) => {
    const [content, setContent] = useState<string | null>(null);
    useEffect(() => {
      async function loadXml(url: string) {
        const cached = await storage.getItem(url);
        if (cached) {
          setContent(cached);
        } else {
          const data = await fetchText(url);
          if (data) {
            storage.setItem(url, data);
            setContent(data);
          }
        }
      }
      if (source) {
        loadXml(source);
      }
    }, [source]);
    return (
      <View {...props} ref={ref}>
        <SvgXml xml={content} width={'100%'} height={'100%'} />
      </View>
    );
  }
);

// From SvgUri in react-native-svg
export async function fetchText(uri: string) {
  const response = await fetch(uri);
  if (response.ok || (response.status === 0 && uri.startsWith('file://'))) {
    return await response.text();
  }
  throw new Error(`Fetching ${uri} failed with status ${response.status}`);
}
