import { formatUd, unixToDa } from '@urbit/aura';
import { useMemo } from 'react';

import { GroupPrivacy } from '../db/schema';
import * as ub from './channel';
import * as ubc from './content';
import * as ubd from './dms';
import * as ubg from './groups';

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

export function preSig(ship: string): string {
  if (!ship) {
    return '';
  }

  if (ship.trim().startsWith('~')) {
    return ship.trim();
  }

  return '~'.concat(ship.trim());
}

export function desig(ship: string): string {
  if (!ship) {
    return '';
  }

  return ship.trim().replace('~', '');
}

export function getFirstInline(content: ub.Story) {
  const inlines = content.filter((v) => 'inline' in v) as ub.VerseInline[];
  if (inlines.length === 0) {
    return null;
  }

  return inlines[0].inline;
}

export function citeToPath(cite: ub.Cite) {
  if ('desk' in cite) {
    return `/1/desk/${cite.desk.flag}${cite.desk.where}`;
  }
  if ('chan' in cite) {
    return `/1/chan/${cite.chan.nest}${cite.chan.where}`;
  }
  if ('group' in cite) {
    return `/1/group/${cite.group}`;
  }

  return `/1/bait/${cite.bait.group}/${cite.bait.graph}/${cite.bait.where}`;
}

export function pathToCite(path: string): ub.Cite | undefined {
  const segments = path.split('/');
  if (segments.length < 3) {
    return undefined;
  }
  const [, ver, kind, ...rest] = segments;
  if (ver !== '1') {
    return undefined;
  }
  if (kind === 'chan') {
    if (rest.length < 3) {
      return undefined;
    }
    const nest = rest.slice(0, 3).join('/');
    return {
      chan: {
        nest,
        where: `/${rest.slice(3).join('/')}` || '/',
      },
    };
  }
  if (kind === 'desk') {
    if (rest.length < 2) {
      return undefined;
    }
    const flag = rest.slice(0, 2).join('/');
    return {
      desk: {
        flag,
        where: `/${rest.slice(2).join('/')}` || '/',
      },
    };
  }
  if (kind === 'group') {
    if (rest.length !== 2) {
      return undefined;
    }
    return {
      group: rest.join('/'),
    };
  }
  return undefined;
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

export function idIsNest(id: string) {
  return id.split('/').length === 3;
}

export function getChannelType(channelId: string) {
  if (!idIsNest(channelId)) {
    if (whomIsDm(channelId)) {
      return 'dm';
    }
    if (whomIsMultiDm(channelId)) {
      return 'groupDm';
    }
  }
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
    return '(Image)';
  } else if (ub.isCite(block)) {
    return '(Reference)';
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

function makeId(our: string) {
  const sent = Date.now();
  return {
    id: `${our}/${formatUd(unixToDa(sent))}`,
    sent,
  };
}

export function createMessage(
  our: string,
  mem: ub.PostEssay,
  replying?: string
): {
  id: string;
  cacheId: ub.CacheId;
  delta: ubd.WritDeltaAdd | ubd.ReplyDelta;
} {
  const { id, sent } = makeId(our);
  const cacheId = { author: mem.author, sent };
  const memo: Omit<ub.PostEssay, 'kind-data'> = {
    content: mem.content,
    author: mem.author,
    sent,
  };

  let delta: ubd.WritDeltaAdd | ubd.ReplyDelta;
  if (!replying) {
    delta = {
      add: {
        memo,
        kind: null,
        time: null,
      },
    };
  } else {
    delta = {
      reply: {
        id,
        meta: null,
        delta: {
          add: {
            memo,
            time: null,
          },
        },
      },
    };
  }

  return { id, cacheId, delta };
}

export function whomIsDm(whom: string): boolean {
  return whom.startsWith('~') && !whom.match('/');
}

export function whomIsMultiDm(whom: string): boolean {
  return whom.startsWith(`0v`);
}

export function useIsDmOrMultiDm(whom: string) {
  return useMemo(() => whomIsDm(whom) || whomIsMultiDm(whom), [whom]);
}

export function extractGroupPrivacy(preview: ubg.Group | null): GroupPrivacy {
  if (!preview) {
    return 'public';
  }

  return preview.secret
    ? 'secret'
    : preview.cordon && 'shut' in preview.cordon
      ? 'private'
      : 'public';
}
