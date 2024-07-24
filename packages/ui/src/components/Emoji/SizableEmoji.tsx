import { FontSizeTokens, SizableTextProps, getFontSize } from 'tamagui';

import { SizableText } from '../../core';
import { getNativeEmoji } from './data';

// unclear what this should be (or how it should be calculated), but seems
// to work?
const MAGIC_HEIGHT_ADJUSTMENT_CONSTANT = 4;

export function SizableEmoji(
  props: SizableTextProps & {
    shortCode: string;
    fontSize: FontSizeTokens | number;
  }
) {
  const { shortCode, fontSize, ...rest } = props;
  const lineHeight = getFontSize(fontSize) + MAGIC_HEIGHT_ADJUSTMENT_CONSTANT;
  return (
    <SizableText {...rest} lineHeight={lineHeight} fontSize={fontSize}>
      {getNativeEmoji(shortCode)}
    </SizableText>
  );
}
