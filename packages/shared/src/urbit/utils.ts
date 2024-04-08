import * as ub from './channel';
import * as ubc from './content';

type App = 'chat' | 'heap' | 'diary';

export function checkNest(nest: string) {
  if (nest.split('/').length !== 3) {
    console.error('Invalid nest:', nest);
  }
}

export function nestToFlag(nest: string): [App, string] {
  checkNest(nest);
  const [app, ...rest] = nest.split('/');

  return [app as App, rest.join('/')];
}

//  encode the string into @ta-safe format, using logic from +wood.
//  for example, 'some Chars!' becomes '~.some.~43.hars~21.'
//  this is equivalent to (scot %t string), and is url-safe encoding for
//  arbitrary strings.
//
//  TODO  should probably go into aura-js
export function stringToTa(string: string) {
  let out = '';
  for (let i = 0; i < string.length; i += 1) {
    const char = string[i];
    let add = '';
    switch (char) {
      case ' ':
        add = '.';
        break;
      case '.':
        add = '~.';
        break;
      case '~':
        add = '~~';
        break;
      default: {
        const codePoint = string.codePointAt(i);
        if (!codePoint) break;
        //  js strings are encoded in UTF-16, so 16 bits per character.
        //  codePointAt() reads a _codepoint_ at a character index, and may
        //  consume up to two js string characters to do so, in the case of
        //  16 bit surrogate pseudo-characters. here we detect that case, so
        //  we can advance the cursor to skip past the additional character.
        if (codePoint > 0xffff) i += 1;
        if (
          (codePoint >= 97 && codePoint <= 122) || // a-z
          (codePoint >= 48 && codePoint <= 57) || // 0-9
          char === '-'
        ) {
          add = char;
        } else {
          add = `~${codePoint.toString(16)}.`;
        }
      }
    }
    out += add;
  }
  return `~~${out}`;
}

export function getChannelType(channelId: string) {
  const [app] = nestToFlag(channelId);

  if (app === 'chat') {
    return 'chat';
  } else if (app === 'heap') {
    return 'gallery';
  } else if (app === 'diary') {
    return 'notebook';
  } else {
    return 'chat';
  }
}

export function getTextContent(story?: ub.Story | undefined) {
  if (!story) {
    return;
  }
  return story
    .map((verse) => {
      if (ubc.isBlock(verse)) {
        return getBlockContent(verse.block);
      } else {
        return getInlinesContent(verse.inline);
      }
    })
    .filter((v) => !!v && v !== '')
    .join(' ')
    .trim();
}

export function getBlockContent(block: ub.Block) {
  if (ub.isImage(block)) {
    return '[image]';
  } else if (ub.isCite(block)) {
    return '[ref]';
  } else if (ubc.isHeader(block)) {
    return block.header.content.map(getInlineContent);
  } else if (ubc.isCode(block)) {
    return block.code.code;
  } else if (ubc.isListing(block)) {
    return getListingContent(block.listing);
  }
}

export function getListingContent(listing: ub.Listing): string {
  if (ubc.isListItem(listing)) {
    return listing.item.map(getInlineContent).join(' ');
  } else {
    return listing.list.items.map(getListingContent).join(' ');
  }
}

export function getInlinesContent(inlines: ubc.Inline[]): string {
  return inlines
    .map(getInlineContent)
    .filter((v) => v && v !== '')
    .join(' ');
}

export function getInlineContent(inline: ubc.Inline): string {
  if (ubc.isBold(inline)) {
    return inline.bold.map(getInlineContent).join(' ');
  } else if (ubc.isItalics(inline)) {
    return inline.italics.map(getInlineContent).join(' ');
  } else if (ubc.isLink(inline)) {
    return inline.link.content;
  } else if (ubc.isStrikethrough(inline)) {
    return inline.strike.map(getInlineContent).join(' ');
  } else if (ubc.isBlockquote(inline)) {
    return inline.blockquote.map(getInlineContent).join(' ');
  } else if (ubc.isInlineCode(inline)) {
    return inline['inline-code'];
  } else if (ubc.isBlockCode(inline)) {
    return inline.code;
  } else if (ubc.isBreak(inline)) {
    return '';
  } else if (ubc.isShip(inline)) {
    return inline.ship;
  } else if (ubc.isTag(inline)) {
    return inline.tag;
  } else if (ubc.isBlockReference(inline)) {
    return inline.block.text;
  } else if (ubc.isTask(inline)) {
    return inline.task.content.map(getInlineContent).join(' ');
  } else {
    return inline;
  }
}
