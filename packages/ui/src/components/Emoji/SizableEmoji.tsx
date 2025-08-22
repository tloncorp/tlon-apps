import { useMemo } from 'react';
import { FontSizeTokens, SizableTextProps, getFontSize } from 'tamagui';
import { SizableText } from 'tamagui';

import { getNativeEmoji } from './data';

// unclear what this should be (or how it should be calculated), but seems
// to work?
const MAGIC_HEIGHT_ADJUSTMENT_CONSTANT = 4;

export function SizableEmoji(
  props: SizableTextProps & {
    emojiInput: string;
    fontSize: FontSizeTokens | number;
  }
) {
  const { emojiInput, fontSize, ...rest } = props;
  const lineHeight = getFontSize(fontSize) + MAGIC_HEIGHT_ADJUSTMENT_CONSTANT;
  const finalEmoji = useMemo(() => getNativeEmoji(emojiInput), [emojiInput]);

  // If getNativeEmoji returns undefined (invalid shortcode), show a placeholder emoji
  // This prevents empty display for legacy shortcodes in the database
  return (
    <SizableText {...rest} lineHeight={lineHeight} fontSize={fontSize}>
      {finalEmoji || '❓'}
    </SizableText>
  );
}
