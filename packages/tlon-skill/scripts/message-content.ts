/**
 * NDJSON records for `tlon messages --json`.
 *
 * Lives outside `messages.ts` because that script runs `main()` at import, so
 * nothing defined in it is reachable from a test. Keep this module
 * side-effect free.
 */
import type { Post } from '@tloncorp/api';
import { redactPostBlobCapabilities } from '@tloncorp/api/client/content-helpers';

import {
  type WindowContext,
  analyzeWindow,
  receiptProxyMs,
  windowContainsPost,
  windowWarning,
} from './messages-runtime';

// JSON.stringify leaves these legal-in-JSON separators literal, and some line
// readers, such as Python's `str.splitlines()`, split on them, fragmenting the
// record. Escaping is lossless.
const JSON_LINE_SEPARATOR_RE = /[\u0085\u2028\u2029]/g;

// Fetchers hand back the story JSON-stringified. Anything that is not a story
// array is carried through verbatim, so the record stays lossless.
function parseStory(content: Post['content']): unknown {
  if (typeof content !== 'string') return content;
  try {
    const parsed: unknown = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : content;
  } catch {
    return content;
  }
}

// The blob can carry signed browser-session URLs, and this output goes
// straight to the model. A blob that does not parse is dropped rather than
// passed through, since its capabilities cannot be found to redact.
function redactBlobJson(blob: Post['blob']): string | null {
  if (!blob) return blob ?? null;
  try {
    return JSON.stringify(redactPostBlobCapabilities(JSON.parse(blob)));
  } catch {
    return null;
  }
}

/** One lossless record: the parsed story, not the plain-text rendering. */
export function renderPostJsonLine(post: Post, annotated = false): string {
  return JSON.stringify({
    id: post.id,
    authorId: post.authorId,
    sentAt: post.sentAt,
    // Receipt time where one exists (DM pact key, or group host arrival);
    // null otherwise. `annotated` mirrors the plaintext (received ...) mark.
    receivedAt: receiptProxyMs(post),
    annotated,
    // JSON.stringify drops undefined keys — normalize so the shape is stable.
    parentId: post.parentId ?? null,
    blob: redactBlobJson(post.blob),
    // (tombstones arrive with content undefined)
    content: parseStory(post.content) ?? null,
  }).replace(
    JSON_LINE_SEPARATOR_RE,
    (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')
  );
}

export interface RenderPostListJsonOptions {
  /** Opt in to receipt/sent divergence analysis (history commands only). */
  window?: WindowContext;
  displayLimit?: number;
  highlightId?: string;
}

export function renderPostListJsonLines(
  posts: Post[],
  { window, displayLimit, highlightId }: RenderPostListJsonOptions = {}
): string[] {
  const analysis = analyzeWindow(posts, window, displayLimit);
  const lines: string[] = [];
  // Window-level prelude: agents parsing NDJSON need the divergence verdict
  // as much as plaintext readers need the warning banner.
  if (window) {
    lines.push(
      JSON.stringify({
        type: 'window',
        warning: windowWarning(
          analysis.inversions,
          window.truncated,
          analysis.displayedLag
        ),
        inversions: analysis.inversions,
        sequenceGaps: analysis.sequenceGaps,
        truncated: window.truncated,
      })
    );
  }
  if (highlightId && !windowContainsPost(analysis.ordered, highlightId)) {
    lines.push(JSON.stringify({ type: 'notice', notice: 'target-absent' }));
  }
  for (const post of analysis.ordered) {
    lines.push(renderPostJsonLine(post, analysis.annotate.has(post)));
  }
  return lines;
}
