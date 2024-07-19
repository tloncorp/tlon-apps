import React, { useMemo } from 'react';
import {
  ColorTokens,
  SizeTokens,
  View,
  styled,
  withStaticProperties,
} from 'tamagui';

import * as icons from '../assets/icons';

export type IconType = keyof typeof icons;

type IconProps = {
  type: IconType;
  color: string;
  width: number;
  height: number;
};

const RawIconGraphic = React.memo(
  React.forwardRef(function RawIconGraphicFn(
    { type, color, width, height }: IconProps,
    ref
  ) {
    const IconComponent = icons[type];
    if (!IconComponent) {
      throw new Error('no icon found for ' + type);
    }
    return (
      <IconComponent color={color} width={width} height={height} ref={ref} />
    );
  })
);

// Wrap icon graphic so we can use tokens to style it.
const IconGraphic = styled(
  RawIconGraphic,
  {},
  {
    accept: {
      color: 'color',
      width: 'size',
      height: 'size',
    },
  }
);

const IconComponent = View.styleable<{
  size?: '$s' | '$m' | '$l' | '$xl';
  customSize?: [number, number];
  color?: ColorTokens;
  type: IconType;
}>(({ size, color, type, customSize, ...props }, ref) => {
  const [frameSize, iconSize]: [SizeTokens, SizeTokens] = useMemo(() => {
    if (customSize) {
      return customSize;
    }

    switch (size ?? '$l') {
      case '$s':
        return ['$l', '$l'];
      case '$m':
        return ['$2xl', '$2xl'];
      case '$l':
        return ['$3xl', '$2xl'];
      case '$xl':
        return ['$4xl', '$3xl'];
    }
    // This shouldn't be necessary, but a bug with tamagui's optimizing
    // compiler caused this to error.
    return ['$m', '$m'];
  }, [customSize, size]);

  return (
    <View
      ref={ref}
      width={frameSize}
      height={frameSize}
      alignItems="center"
      justifyContent="center"
      {...props}
    >
      <IconGraphic
        type={type}
        color={color ?? '$primaryText'}
        width={iconSize}
        height={iconSize}
      />
    </View>
  );
});

export const Icon = withStaticProperties(IconComponent, {
  Graphic: IconGraphic,
});
