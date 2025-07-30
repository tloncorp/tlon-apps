import { getNativeEmoji } from '@tloncorp/ui';
import { FontSizeTokens, SizableTextProps, getFontSize } from 'tamagui';
import { SizableText } from 'tamagui';

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
  const nativeEmoji = getNativeEmoji(shortCode);
  // If getNativeEmoji returns undefined (invalid shortcode), show a placeholder emoji
  // This prevents empty display for legacy shortcodes in the database
  return (
    <SizableText {...rest} lineHeight={lineHeight} fontSize={fontSize}>
      {nativeEmoji || '❓'}
    </SizableText>
  );
}
