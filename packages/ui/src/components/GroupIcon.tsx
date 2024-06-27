import * as db from '@tloncorp/shared/dist/db';
import { PropsWithChildren } from 'react';

import {
  FontSizeTokens,
  Image,
  RadiusTokens,
  SizeTokens,
  Text,
  View,
} from '../core';
import { getBackgroundColor } from '../utils/colorUtils';

export function GroupIconContainer({
  children,
  backgroundColor,
  size,
  borderRadius,
}: PropsWithChildren<{
  backgroundColor: string;
  size: SizeTokens;
  borderRadius: RadiusTokens;
}>) {
  return (
    <View
      width={size}
      height={size}
      borderRadius={borderRadius}
      overflow="hidden"
      flex={0}
      backgroundColor={backgroundColor as any}
    >
      {children}
    </View>
  );
}

export function GroupIcon({
  group,
  size = '$4xl',
  fontSize = '$m',
  borderRadius = '$s',
}: {
  group: db.Group;
  size?: SizeTokens;
  fontSize?: FontSizeTokens;
  borderRadius?: RadiusTokens;
}) {
  const colors = { backgroundColor: '$secondaryBackground' };
  const fallbackText = group.title ?? group.id;
  const backgroundColor = getBackgroundColor({
    disableAvatars: false,
    colors,
    model: group,
  });
  const imageUrl = group.iconImage ? group.iconImage : undefined;

  if (imageUrl) {
    return (
      <GroupIconContainer
        size={size}
        backgroundColor={backgroundColor}
        borderRadius={borderRadius}
      >
        <Image
          width={'100%'}
          height={'100%'}
          contentFit="cover"
          source={{
            uri: imageUrl,
          }}
        />
      </GroupIconContainer>
    );
  }

  return (
    <GroupIconContainer
      size={size}
      backgroundColor={backgroundColor}
      borderRadius={borderRadius}
    >
      <View flex={1} alignItems="center" justifyContent="center">
        <Text fontSize={fontSize} color="$primaryText">
          {fallbackText.slice(0, 1).toUpperCase()}
        </Text>
      </View>
    </GroupIconContainer>
  );
}
