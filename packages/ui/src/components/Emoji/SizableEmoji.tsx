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
  const finalEmoji = useMemo(() => {
    const emoji = getNativeEmoji(emojiInput);

    // Check if input is already a Unicode emoji:
    // 1. Matches Unicode emoji pattern (including presentation style)
    // 2. Is not found in our emoji mapping
    // 3. Does not include control characters or unwanted symbols
    const isEmojiPattern = /^\p{Emoji}+$/u.test(emojiInput);
    const hasEmojiPresentation = /\p{Emoji_Presentation}/u.test(emojiInput);
    const isNotControlChar = !/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(emojiInput);

    const isDirectEmoji =
      isEmojiPattern && hasEmojiPresentation && isNotControlChar && !emoji;

    return isDirectEmoji ? emojiInput : emoji;
  }, [emojiInput]);

  return (
    <SizableText {...rest} lineHeight={lineHeight} fontSize={fontSize}>
      {finalEmoji}
    </SizableText>
  );
}
