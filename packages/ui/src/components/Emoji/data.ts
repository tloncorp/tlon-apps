import EmojiData, { EmojiMartData } from '@emoji-mart/data';

export const ALL_EMOJIS = Object.keys((EmojiData as EmojiMartData).emojis);

export function getNativeEmoji(shortcode: string) {
  const sanitizedShortcode = shortcode.replace(/^:|:$/g, '');
  try {
    return (EmojiData as EmojiMartData).emojis[sanitizedShortcode]?.skins[0]
      .native;
  } catch (e) {
    console.error(`Parsing emoji shortcode ${shortcode} failed: ${e}`);
    return '🛑';
  }
}
