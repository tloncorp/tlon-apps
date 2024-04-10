import EmojiData, { EmojiMartData } from '@emoji-mart/data';

export function getNativeEmoji(shortcode: string) {
  return (EmojiData as EmojiMartData).emojis[shortcode].skins[0].native;
}
