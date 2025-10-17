import { render, valid, da } from '@urbit/aura';

import { PostContent } from '../api';
import { ChannelType } from '../db';
import { GroupJoinStatus, GroupPrivacy } from '../db/schema';
import { createDevLogger } from '../debug';
import { ContentReference } from '../domain';
import * as ub from './channel';
import * as ubc from './content';
import * as ubg from './groups';
import { Atom } from '@urbit/nockjs';

const logger = createDevLogger('urbitUtils', false);

type App = 'chat' | 'heap' | 'diary';
const APP_PREFIXES = ['chat', 'heap', 'diary'];

export function checkNest(nest: string): boolean {
  const parts = nest.split('/');
  if (parts.length !== 3) {
    logger.error('Invalid nest:', nest);
    return false;
  }

  if (!APP_PREFIXES.includes(parts[0])) {
    logger.log(
      `Custom channel type detected (${parts[0]}), pretending its chat.`,
      nest
    );
    return false;
  }

  return true;
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

export function citeToPath(cite: ubc.Cite) {
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

export function pathToCite(path: string): ubc.Cite | undefined {
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

//  encode the string as @t into url-safe format, using logic from +wood.
//  for example, 'some Chars!' becomes '~.some.~43.hars~21.'
//  this is equivalent to (scot %t string), and is url-safe encoding for
//  arbitrary strings.
//
export function encodeString(string: string) {
  return render('t', Atom.fromCord(string).number);
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

export function getChannelKindFromType(
  type: Omit<ChannelType, 'dm' | 'groupDm'>
) {
  if (type === 'chat') {
    return 'chat';
  } else if (type === 'gallery') {
    return 'heap';
  } else if (type === 'notebook') {
    return 'diary';
  } else {
    return 'chat';
  }
}

export function getTextContent(story: PostContent): string;
export function getTextContent(story?: PostContent): string | undefined {
  if (!story) {
    return;
  }
  return story
    .map((verse) => {
      if (isReferenceVerse(verse)) {
        return '';
      } else if (ub.isBlockVerse(verse)) {
        return getBlockContent(verse.block);
      } else if ('inline' in verse) {
        return getInlinesContent(verse.inline);
      } else {
        return '';
      }
    })
    .filter((v) => !!v && v !== '')
    .join(' ')
    .trim();
}

function isReferenceVerse(
  verse: ub.Verse | ContentReference
): verse is ContentReference {
  return 'type' in verse && verse.type === 'reference';
}

export function getBlockContent(block: ubc.Block) {
  if (ubc.isImage(block)) {
    return '(Image)';
  } else if (ubc.isCite(block)) {
    return '(Reference)';
  } else if (ubc.isHeader(block)) {
    return block.header.content.map(getInlineContent);
  } else if (ubc.isCode(block)) {
    return block.code.code;
  } else if (ubc.isListing(block)) {
    return getListingContent(block.listing);
  }
}

export function getListingContent(listing: ubc.Listing): string {
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
  } else if (ubc.isSect(inline)) {
    return `@${inline.sect || 'all'}`;
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

export function whomIsDm(whom: string): boolean {
  return whom.startsWith('~') && !whom.match('/');
}

export function whomIsMultiDm(whom: string): boolean {
  return whom.startsWith(`0v`);
}

// ship + term, term being a @tas: lower-case letters, numbers, and hyphens
export function whomIsFlag(whom: string): boolean {
  return (
    /^~[a-z-]+\/[a-z]+[a-z0-9-]*$/.test(whom) && valid('p', whom.split('/')[0])
  );
}

export function createMultiDmId(seed = Date.now()) {
  return render('uv', da.fromUnix(seed));
}

export function getJoinStatusFromGang(gang: ubg.Gang): GroupJoinStatus | null {
  if (gang.claim?.progress) {
    if (
      gang.claim?.progress === 'adding' ||
      gang.claim?.progress === 'watching'
    ) {
      return 'joining';
    }

    // still consider the join in progress until the claim is removed
    if (gang.claim?.progress === 'done') {
      return 'joining';
    }

    if (gang.claim?.progress === 'error') {
      return 'errored';
    }
  }

  return null;
}

export function extractGroupPrivacy(
  preview: ubg.GroupPreview | ubg.Group | null,
  claim?: ubg.GroupClaim
): GroupPrivacy {
  if (!preview) {
    if (claim?.progress === 'knocking') {
      // sometimes gangs are missing the preview while joining,
      // however we'll know it's private if the claim is 'knocking'
      return 'private';
    }

    // conservative default if something is wrong and we don't otherwise know
    return 'private';
  }

  return preview.secret
    ? 'secret'
    : preview.cordon && 'shut' in preview.cordon
      ? 'private'
      : 'public';
}

export function createSectionId() {
  const idParts = render('uv', BigInt(Date.now())).split('.');
  const newSectionId = `z${idParts[idParts.length - 1]}`;

  return newSectionId;
}
