import { valid } from '@urbit/aura';

import type * as db from '../types/models';
import type { ContentReference } from '../types/references';
import type * as ub from '../urbit';
import { parseIdNumber } from '../urbit/utils';

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

// Terms that reach the wire must parse as `sym` (@tas) — anything else
// crashes the poke (desk/lib/cite-json.hoon).
const SYM_REGEX = /^[a-z][a-z0-9-]*$/;

// Canonical numerals only: plain digits with no leading zero, or urbit
// dot-grouping in exact groups of three with a nonzero leading group. Sloppy
// forms (1..2, 1.2, 012, 0.001) are rejected because recipients strip dots on
// receipt, so accepting them would silently emit a card for a different
// note/post id.
const PLAIN_NUMERAL_REGEX = /^(0|[1-9]\d*)$/;
const DOT_GROUPED_NUMERAL_REGEX = /^[1-9]\d{0,2}(\.\d{3})+$/;

function isValidIdSegment(segment: string): boolean {
  return (
    PLAIN_NUMERAL_REGEX.test(segment) || DOT_GROUPED_NUMERAL_REGEX.test(segment)
  );
}

const LEADING_DECORATION = new Set([
  '(',
  '[',
  '{',
  '<',
  '"',
  "'",
  '`',
  '‘',
  '“',
]);
const TRAILING_DECORATION = new Set([
  '.',
  ',',
  ';',
  ':',
  '!',
  '?',
  ')',
  ']',
  '}',
  '>',
  '"',
  "'",
  '`',
  '’',
  '”',
  '…',
]);

function stripTokenDecorations(token: string): string {
  let core = token;
  let changed = true;
  while (changed && core.length > 0) {
    changed = false;
    while (core.length > 0 && LEADING_DECORATION.has(core[0])) {
      core = core.slice(1);
      changed = true;
    }
    while (core.length > 0 && TRAILING_DECORATION.has(core[core.length - 1])) {
      core = core.slice(0, -1);
      changed = true;
    }
    // Emphasis markers are stripped only as balanced pairs of equal-length
    // runs. An unbalanced trailing */_ is never trimmed: it may be part of
    // the path itself (e.g. a malformed slug ending in _), and stripping it
    // would fabricate a cite for a different group.
    // A homogeneous run only: a mixed prefix like *_ is not an emphasis
    // wrapper and must not be length-matched against a trailing run.
    const leadingRun = /^(\*+|_+)/.exec(core)?.[0];
    if (leadingRun) {
      const marker = leadingRun[0];
      let trailingRunLength = 0;
      while (
        trailingRunLength < core.length - leadingRun.length &&
        core[core.length - 1 - trailingRunLength] === marker
      ) {
        trailingRunLength++;
      }
      if (trailingRunLength === leadingRun.length) {
        core = core.slice(leadingRun.length, core.length - leadingRun.length);
        changed = true;
      }
    }
  }
  return core;
}

// Match one of the canonical client-produced reference path forms exactly
// (what getGroupReferencePath/getPostReferencePath/getNoteReferencePath emit,
// plus the legacy /msg/~author/<id> form found in old posts). Deliberately
// stricter than toContentReference's tolerant parser: anything no producer
// emits is rejected so it stays literal text.
function matchReferencePath(core: string): ub.Cite | null {
  const segments = core.split('/');
  if (segments[0] !== '' || segments[1] !== '1') {
    return null;
  }
  const kind = segments[2];
  if (kind === 'group') {
    // /1/group/~ship/slug
    if (segments.length !== 5) {
      return null;
    }
    const ship = segments[3];
    const slug = segments[4];
    if (!valid('p', ship) || !SYM_REGEX.test(slug)) {
      return null;
    }
    return { group: `${ship}/${slug}` };
  }
  if (kind === 'chan') {
    // /1/chan/<chan-kind>/~host/name<where> — the shortest accepted where
    // is two segments (/msg/<id> or /note/<id>), so a chan path is at
    // least 8 segments long.
    if (segments.length < 8) {
      return null;
    }
    const chanKind = segments[3];
    if (
      chanKind !== 'chat' &&
      chanKind !== 'heap' &&
      chanKind !== 'diary' &&
      chanKind !== 'notes'
    ) {
      return null;
    }
    const host = segments[4];
    const name = segments[5];
    if (!valid('p', host) || !SYM_REGEX.test(name)) {
      return null;
    }
    const nest = `${chanKind}/${host}/${name}`;
    const where = segments.slice(6);
    if (chanKind === 'notes') {
      // /1/chan/notes/~host/name/note/<id>
      if (where.length !== 2 || where[0] !== 'note') {
        return null;
      }
      if (!isValidIdSegment(where[1])) {
        return null;
      }
      return { chan: { nest, where: `/note/${where[1]}` } };
    }
    if (where[0] !== 'msg') {
      return null;
    }
    if (where.length === 2) {
      // /msg/<id>
      if (!isValidIdSegment(where[1])) {
        return null;
      }
      return { chan: { nest, where: `/msg/${where[1]}` } };
    }
    if (where.length === 3) {
      if (where[1].startsWith('~')) {
        // legacy /msg/~author/<id>
        if (!valid('p', where[1]) || !isValidIdSegment(where[2])) {
          return null;
        }
        return { chan: { nest, where: `/msg/${where[1]}/${where[2]}` } };
      }
      // /msg/<id>/<reply>
      if (!isValidIdSegment(where[1]) || !isValidIdSegment(where[2])) {
        return null;
      }
      return { chan: { nest, where: `/msg/${where[1]}/${where[2]}` } };
    }
    return null;
  }
  return null;
}

/**
 * Extract canonical reference paths from outbound message text, the same
 * contract the first-party composer gives typed text: accepted tokens become
 * cites (in encounter order) and are removed from the text; anything else is
 * left untouched. Extraction is whitespace-token based and sees raw text, so
 * a path inside code formatting (backticks included) is also converted — to
 * show syntax without creating a card, write a placeholder with no tilde
 * (e.g. /1/group/HOST/SLUG); a ~-prefixed fake name fails validation here
 * but may still be parsed downstream as a broken ship mention. URLs are safe
 * by construction: a URL is one token whose core does not start with /1/.
 */
export function extractReferencePaths(text: string): {
  text: string;
  cites: ub.Cite[];
} {
  const cites: ub.Cite[] = [];
  const outputLines: string[] = [];
  for (const line of text.split('\n')) {
    // Splice accepted tokens out of the original line rather than rebuilding
    // it from tokens: residual whitespace is structural in Markdown (list
    // nesting, indented code), so everything around a removed token must
    // survive byte-for-byte.
    let result = '';
    let cursor = 0;
    let removedAny = false;
    for (const match of line.matchAll(/\S+/g)) {
      const token = match[0];
      const cite = matchReferencePath(stripTokenDecorations(token));
      if (!cite) {
        continue;
      }
      // Remove the entire original token so decorations like **...** leave
      // no residue behind, plus one adjacent separator so the removal does
      // not leave a doubled gap.
      cites.push(cite);
      removedAny = true;
      result += line.slice(cursor, match.index);
      cursor = match.index + token.length;
      if (result === '' || /\s$/.test(result)) {
        const following = /^\s+/.exec(line.slice(cursor));
        if (following) {
          cursor += following[0].length;
        }
      }
    }
    if (!removedAny) {
      outputLines.push(line);
      continue;
    }
    result += line.slice(cursor);
    result = result.replace(/\s+$/, '');
    if (/\S/.test(result)) {
      outputLines.push(result);
    }
    // A line left empty by removal is dropped.
  }
  return { text: outputLines.join('\n'), cites };
}
