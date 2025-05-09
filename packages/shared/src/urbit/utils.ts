import { formatUv, isValidPatp, unixToDa } from '@urbit/aura';

import { ChannelType } from '../db';
import { GroupJoinStatus, GroupPrivacy } from '../db/schema';
import { createDevLogger } from '../debug';
import * as ub from './channel';
import * as ubg from './groups';

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

export function whomIsDm(whom: string): boolean {
  return whom.startsWith('~') && !whom.match('/');
}

export function whomIsMultiDm(whom: string): boolean {
  return whom.startsWith(`0v`);
}

// ship + term, term being a @tas: lower-case letters, numbers, and hyphens
export function whomIsFlag(whom: string): boolean {
  return (
    /^~[a-z-]+\/[a-z]+[a-z0-9-]*$/.test(whom) && isValidPatp(whom.split('/')[0])
  );
}

export function createMultiDmId(seed = Date.now()) {
  return formatUv(unixToDa(seed));
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
  const idParts = formatUv(BigInt(Date.now())).split('.');
  const newSectionId = `z${idParts[idParts.length - 1]}`;

  return newSectionId;
}
