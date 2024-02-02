import {icons} from '@assets';
import {useColorProp} from '@theme';
import React from 'react';
import {ColorProp, SizeTokens, Token, getToken} from 'tamagui';
import {XStack} from './core';

export type IconName = keyof typeof icons;

export type IconProps = {
  icon: IconName;
  color?: ColorProp;
  size?: SizeTokens;
};

const BaseIcon = XStack.styleable<IconProps>(
  ({icon, color = '$color', size = '$m', ...props}: IconProps, ref) => {
    const IconComponent = icons[icon];
    const resolvedColor = useColorProp(color);
    const resolvedSize = getToken(size as Token, 'size');
    return (
      <IconComponent
        ref={ref}
        {...props}
        color={resolvedColor}
        width={resolvedSize}
        height={resolvedSize}
      />
    );
  },
);

export const Icon = React.memo(BaseIcon);
