import emojiRegex from 'emoji-regex';

export function isEmoji(emojiInput: string) {
  const regex = emojiRegex();
  return regex.test(emojiInput);
}
