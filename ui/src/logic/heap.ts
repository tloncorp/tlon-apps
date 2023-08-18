/* eslint-disable */
import { CurioHeart, CurioInputMode } from '@/types/heap';

function placeholderParser(content: string) {
  let inline = [];
  let curr = '';
  for (let char of content) {
    if (char === '\n') {
      inline.push(curr);
      inline.push({ break: null });
      curr = '';
    } else {
      curr += char;
    }
  }
  inline.push(curr);

  return inline;
}

export function createCurioHeart(
  content: string,
  contentType: CurioInputMode
): CurioHeart {
  const inline =
    contentType === 'text'
      ? placeholderParser(content)
      : [{ link: { href: content, content } }];

  return {
    title: '',
    content: {
      block: [],
      inline,
    },
    author: window.our,
    sent: Date.now(),
    replying: null,
  };
}

export default createCurioHeart;
