import _ from 'lodash';

import type * as db from '../types/models';
import type { ContentReference } from '../types/references';
import type * as ub from '../urbit';
import { citeToPath, parseIdNumber } from '../urbit/utils';
import { formatUd } from './apiUtils';

function formatId(id: string) {
  return parseIdNumber(id).toString();
}

// The "display id" for a post reference: the reply's own id when the reference
// points at a reply, otherwise the (top-level) post id. This is the id under
// which the hydrated post is fetched, cached, and read back, so it must be
// computed identically everywhere it's used.
export function referenceLookupId({
  postId,
  replyId,
}: {
  postId: string;
  replyId?: string;
}): string {
  return replyId ?? postId;
}

export function getPostReferencePath(post: db.Post) {
  if (post.parentId) {
    return `/1/chan/${post.channelId}/msg/${formatId(post.parentId)}/${formatId(post.id)}`;
  }
  return `/1/chan/${post.channelId}/msg/${formatId(post.id)}`;
}

export function getGroupReferencePath(groupId: string) {
  return `/1/group/${groupId}`;
}

export function getChannelReferencePath(channelId: string) {
  return `/1/chan/${channelId}`;
}

// A reference written into text starts a word, or follows opening
// punctuation (`(/1/chan/...`); one glued to other text
// (`https://host/1/chan/...`) belongs to that text.
const REFERENCE_PREFIX = /[\s("'[]/;

export function isReferenceBoundary(text: string, index: number): boolean {
  return index === 0 || REFERENCE_PREFIX.test(text[index - 1]);
}

// A bare channel path typed or pasted as text. Channel names are @tas terms,
// so trailing punctuation (`see /1/chan/chat/~zod/general.`) is prose, not
// part of the nest.
const BARE_CHANNEL_PATH_REGEX =
  /^([("'[]*)\/1\/chan\/([a-z][a-z0-9-]*\/~[a-z-]+\/[a-z][a-z0-9-]*)\/?([.,;:!?'")\]]*)$/;

export type BareChannelPath = {
  // Where the whitespace-delimited word holding the path starts.
  index: number;
  token: string;
  channelId: string;
  leading: string;
  trailing: string;
};

// Channel paths standing as their own whitespace-delimited words, optionally
// wrapped in punctuation. The last word may still be mid-typing, so it counts
// only when the caller knows the text arrived in bulk (a paste).
export function findBareChannelPaths(
  text: string,
  { includeLastWord }: { includeLastWord: boolean }
): BareChannelPath[] {
  const paths: BareChannelPath[] = [];
  for (const match of text.matchAll(/\S+/g)) {
    const token = match[0];
    if (!includeLastWord && match.index + token.length === text.length) {
      continue;
    }
    const parsed = token.match(BARE_CHANNEL_PATH_REGEX);
    if (parsed) {
      paths.push({
        index: match.index,
        token,
        channelId: parsed[2],
        leading: parsed[1],
        trailing: parsed[3],
      });
    }
  }
  return paths;
}

// Swaps a found path for its surrounding punctuation. The path is matched at
// the span it was found at; if an edit since then has moved it, the same word
// elsewhere stands in. Returns null when the word is gone.
export function replaceBareChannelPath(
  text: string,
  { index, token, leading, trailing }: BareChannelPath
): string | null {
  const isWordAt = (start: number) =>
    text.startsWith(token, start) &&
    (start === 0 || /\s/.test(text[start - 1])) &&
    (start + token.length === text.length ||
      /\s/.test(text[start + token.length]));
  let start: number | undefined = isWordAt(index) ? index : undefined;
  if (start === undefined) {
    for (const match of text.matchAll(/\S+/g)) {
      if (match[0] === token) {
        start = match.index;
        break;
      }
    }
  }
  if (start === undefined) {
    return null;
  }
  return (
    text.slice(0, start) + leading + trailing + text.slice(start + token.length)
  );
}

export function channelToContentReference(
  channelId: string
): [path: string, reference: ContentReference] {
  return [
    getChannelReferencePath(channelId),
    { type: 'reference', referenceType: 'channelLink', channelId },
  ];
}

export function getNoteReferencePath(
  channelId: string,
  noteId: string | number
) {
  return `/1/chan/${channelId}/note/${noteId}`;
}

export function noteToContentReference(
  channelId: string,
  noteId: string | number
): [path: string, reference: ContentReference] {
  return [
    getNoteReferencePath(channelId, noteId),
    {
      type: 'reference',
      referenceType: 'note',
      channelId,
      noteId: String(noteId),
    },
  ];
}

export function postToContentReference(
  post: db.Post
): [path: string, reference: ContentReference] {
  const path = getPostReferencePath(post);
  return [
    path,
    {
      referenceType: 'channel',
      type: 'reference',
      // For a reply, postId is the parent/top-level id and replyId the reply's
      // own id, matching the postId=parent / replyId=reply contract used by the
      // hydration path. Top-level posts carry only postId.
      ...(post.parentId
        ? { postId: post.parentId, replyId: post.id }
        : { postId: post.id }),
      channelId: post.channelId,
    },
  ];
}

export function toContentReference(cite: ub.Cite): ContentReference | null {
  if ('chan' in cite) {
    const channelId = cite.chan.nest;
    // A cite of the channel itself, with no post: /1/chan/<nest>
    if (cite.chan.where.replace(/\/+$/, '') === '') {
      return { type: 'reference', referenceType: 'channelLink', channelId };
    }
    // notes channels cite individual notes as /note/<id>, where the id
    // may be dot-grouped urbit-style (1.234)
    if (channelId.startsWith('notes/')) {
      const noteMatch = cite.chan.where.match(/^\/note\/(\d[\d.]*)/);
      if (!noteMatch) {
        return null;
      }
      return {
        type: 'reference',
        referenceType: 'note',
        channelId,
        noteId: noteMatch[1].replace(/\./g, ''),
      };
    }
    // I've seen these forms of reference path:
    // /msg/170141184506828851385935487131294105600
    // /msg/170141184506312077223314290444316180480/170141184506312235291442423303751335936
    // /msg/~sogrum-savluc/170.141.184.505.979.681.243.072.382.329.337.971.474
    const messageIdRegex = /\/([0-9\.]+(?=[$\/]?))/g;
    const [postId, replyId] = Array.from(
      cite.chan.where.matchAll(messageIdRegex)
    ).map((m) => {
      return m[1].replace(/\./g, '');
    });
    if (!postId) {
      return null;
    }
    return {
      type: 'reference',
      referenceType: 'channel',
      channelId,
      postId: formatUd(postId),
      replyId: replyId ? formatUd(replyId) : undefined,
    };
  } else if ('group' in cite) {
    return { type: 'reference', referenceType: 'group', groupId: cite.group };
  } else if ('desk' in cite) {
    const parts = cite.desk.flag.split('/');
    const userId = parts[0];
    const appId = parts[1];
    if (!userId || !appId) {
      return null;
    }
    return { type: 'reference', referenceType: 'app', userId, appId };
  }
  return null;
}

// Edit flows rebuild a post's references from the cites toContentReference
// parses, and the editors have no node for any other cite, so saving an edit
// would silently drop these.
export function getUneditableCites(
  story: ReadonlyArray<object> | null | undefined
): ub.Cite[] {
  return (story ?? []).flatMap((verse) =>
    'block' in verse &&
    verse.block &&
    typeof verse.block === 'object' &&
    'cite' in verse.block &&
    !toContentReference(verse.block.cite as ub.Cite)
      ? [verse.block.cite as ub.Cite]
      : []
  );
}

// The original's uneditable cites that an edit would lose. Each edited cite
// accounts for one original, so a duplicate the edit keeps only once still
// counts as dropped.
export function getDroppedCites(
  originalStory: ReadonlyArray<object> | null | undefined,
  editedCites: ub.Cite[]
): ub.Cite[] {
  const unmatched = [...editedCites];
  return getUneditableCites(originalStory).filter((cite) => {
    const index = unmatched.findIndex((edited) => _.isEqual(edited, cite));
    if (index === -1) return true;
    unmatched.splice(index, 1);
    return false;
  });
}

export function uneditableCitesMessage(cites: ub.Cite[]): string {
  // Matches the render fallback: only a kind this build doesn't know is
  // something an upgrade can fix.
  return cites.some((cite) => !citeToPath(cite))
    ? 'Upgrade your app to edit this post'
    : "This post has a reference that can't be edited";
}

// Checked by name: the app and the store can load separate copies of this
// module, so instanceof doesn't hold across them.
export class UneditableCitesError extends Error {
  constructor(cites: ub.Cite[]) {
    super(uneditableCitesMessage(cites));
    this.name = 'UneditableCitesError';
  }
}

export function isUneditableCitesError(error: unknown): error is Error {
  return error instanceof Error && error.name === 'UneditableCitesError';
}

export function contentReferenceToCite(reference: ContentReference): ub.Cite {
  if (reference.referenceType === 'channel') {
    return {
      chan: {
        nest: reference.channelId,
        where: `/msg/${reference.postId}${
          reference.replyId ? '/' + reference.replyId : ''
        }`,
      },
    };
  } else if (reference.referenceType === 'channelLink') {
    return {
      chan: {
        nest: reference.channelId,
        where: '/',
      },
    };
  } else if (reference.referenceType === 'group') {
    return {
      group: reference.groupId,
    };
  } else if (reference.referenceType === 'app') {
    return {
      desk: {
        flag: `${reference.userId}/${reference.appId}`,
        where: '',
      },
    };
  } else if (reference.referenceType === 'note') {
    return {
      chan: {
        nest: reference.channelId,
        where: `/note/${reference.noteId}`,
      },
    };
  }
  throw new Error('invalid reference');
}
