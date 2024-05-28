import { FontSizeTokens, SizableTextProps, getFontSize } from 'tamagui';

import { SizableText } from '../../core';
import { getNativeEmoji } from './data';

export function SizableEmoji(
  props: SizableTextProps & {
    shortCode: string;
    fontSize: FontSizeTokens | number;
  }
) {
  const { shortCode, fontSize, ...rest } = props;
  const lineHeight = getFontSize(fontSize) + 2; // TODO: fix
  return (
    <SizableText {...rest} lineHeight={lineHeight} fontSize={fontSize}>
      {getNativeEmoji(shortCode)}
    </SizableText>
  );
}
