/**
 * Pure logic for windowed message reads (receipt-order detection, warnings,
 * and annotations). No value imports from '@tloncorp/api' — the process-wide
 * test mock does not export them, so this module must stay importable under
 * bun test.
 */
import type { Post } from '@tloncorp/api';

// Same-second jitter only; anything larger is a real ordering disagreement
export const INVERSION_TOLERANCE_MS = 1_000;
// |receipt - sent| beyond this marks the message with a (received ...) note
export const RECEIPT_LAG_NOTE_MS = 5 * 60 * 1000;

const DA_SECOND = BigInt('18446744073709551616');
const DA_UNIX_EPOCH = BigInt('170141184475152167957503069145530368000');

// Convert a @da ud (e.g. '170.141.184...') to unix milliseconds
export function udToUnixMs(ud: string): number | null {
  try {
    // Enforce the unsigned dotted-decimal @ud shape before parsing: BigInt
    // also accepts hex/octal/binary prefixes, which could smuggle a non-@ud
    // representation past the era check below.
    if (!/^\d+(?:\.\d+)*$/.test(ud)) return null;
    const digits = ud.replace(/\./g, '');
    const daNum = BigInt(digits);
    const offset = DA_SECOND / BigInt(2000);
    const epochAdjusted = offset + (daNum - DA_UNIX_EPOCH);
    const unixMs = Math.round(
      Number((epochAdjusted * BigInt(1000)) / DA_SECOND)
    );
    // Malformed-but-parseable input ("1", "-1", hex strings) converts to an
    // implausible date; treat anything outside the supported era as
    // unparseable rather than fabricating enormous receipt lag (same bounds
    // as formatTime's display check).
    const year = new Date(unixMs).getFullYear();
    if (!(year > 2020 && year < 2100)) return null;
    return unixMs;
  } catch {
    return null;
  }
}

// Receipt time of a post from its backendTime (@da ud), if present
export function receiptTimeMs(post: Post): number | null {
  if (!post.backendTime) return null;
  return udToUnixMs(post.backendTime);
}

function isGroupChannelPost(post: Post): boolean {
  return /^(chat|diary|heap|notes)\//.test(post.channelId ?? '');
}

// Best-available receipt time for a post. DM/club writs carry the pact key in
// backendTime (their receivedAt is derived from the sent-time id segment and
// holds no receipt information). Group-channel posts carry no backendTime,
// but their client id IS the host-assigned arrival key, so receivedAt is the
// host's receipt time — good enough for lag detection and display.
export function receiptProxyMs(post: Post): number | null {
  const fromSeal = receiptTimeMs(post);
  if (fromSeal !== null) return fromSeal;
  if (
    isGroupChannelPost(post) &&
    typeof post.receivedAt === 'number' &&
    !post.isSequenceStub
  ) {
    return post.receivedAt;
  }
  return null;
}

export interface WindowContext {
  // Whether the page excludes any messages — in either direction. An
  // `around` page (context command) can be complete on the older edge but
  // truncated on the newer one, and a skew-excluded message can sit beyond
  // either boundary.
  truncated: boolean;
}

// Derive window context from a posts page's pagination cursors
export function windowFromPage(
  page: {
    older?: string | null;
    newer?: string | null;
    posts?: Post[];
  },
  requested?: number
): WindowContext {
  // A page holding more posts than requested carries a boundary probe that
  // will be trimmed from display — the displayed window is truncated even
  // when the cursors say the fetched page is complete. Without receipt order
  // the probe is NOT trimmed (everything is displayed), so an overfetched
  // ineligible page with no cursors is genuinely complete, not truncated.
  const posts = page.posts ?? [];
  const overfetched =
    requested !== undefined &&
    posts.length > requested &&
    hasReceiptOrder(posts);
  return {
    truncated: page.older != null || page.newer != null || overfetched,
  };
}

export interface WindowAnalysis {
  eligible: boolean;
  inversions: number;
  // Material sent/received divergence among the *displayed* posts — the lag
  // safety net's input. A trimmed boundary probe stays in `annotate` but must
  // not trigger a warning about messages the reader cannot see.
  displayedLag: boolean;
  // Sequence numbers inside the displayed window's range with no returned
  // record. Not proof of withheld data: group-channel moderation hooks burn
  // a sequence number when they reject a post (channels-server increments
  // count before running hooks), and old backends drop deleted posts
  // entirely. History fetches skip gap-fill stubs, so this is the remaining
  // evidence either way.
  sequenceGaps: number;
  ordered: Post[];
  // Keyed by post object identity: DM client ids strip the author prefix,
  // so two participants claiming the same sent millisecond share an id.
  annotate: Set<Post>;
}

// Whether a page carries usable receipt order — the precondition for probe
// trimming and receipt-order display. Every post must have a positive AND
// unique sequence number: a club pact restored through the backend's
// %egg-any merge is not renumbered, so distinct writs can share a seq, and a
// tied comparator would fall back to input order (sent-derived) — exactly
// the ordering this module exists to distrust.
export function hasReceiptOrder(posts: Post[]): boolean {
  const seen = new Set<number>();
  for (const post of posts) {
    if (!hasPositiveSequenceNum(post)) return false;
    const seq = post.sequenceNum as number;
    if (seen.has(seq)) return false;
    seen.add(seq);
  }
  return true;
}

function hasPositiveSequenceNum(post: Post): boolean {
  return typeof post.sequenceNum === 'number' && post.sequenceNum > 0;
}

function sortBySentAt(posts: Post[]): Post[] {
  return [...posts].sort((a, b) => a.sentAt - b.sentAt);
}

// Analyze a page of posts for receipt/sent ordering disagreement. Only
// applies when the caller opts in with a window context and every post has a
// positive sequenceNum (top-level pages; replies carry the dummy seq 0).
// Ineligible lists keep sentAt ordering but still collect lag annotations.
//
// When displayLimit is given and the page holds more posts, the receipt-oldest
// post is a boundary probe: it participates in inversion detection (so skew
// that crosses the window boundary still warns) but is dropped from `ordered`,
// keeping the displayed window at the requested size.
export function analyzeWindow(
  posts: Post[],
  window?: WindowContext,
  displayLimit?: number
): WindowAnalysis {
  const annotate = new Set<Post>();
  // Parse each receipt exactly once — the displaced-post scan below would
  // otherwise redo the BigInt conversion O(n²) times on inverted windows.
  const receipts = new Map<Post, number | null>();
  for (const post of posts) {
    const receipt = receiptProxyMs(post);
    receipts.set(post, receipt);
    if (
      receipt !== null &&
      Math.abs(receipt - post.sentAt) > RECEIPT_LAG_NOTE_MS
    ) {
      annotate.add(post);
    }
  }

  const eligible = window !== undefined && hasReceiptOrder(posts);
  if (!eligible) {
    // Without sequence numbers the receipt-oldest post (the probe) is
    // unknowable, and trimming by sent time could drop a real newest message
    // while keeping the probe — display everything instead.
    const ordered = sortBySentAt(posts);
    return {
      eligible,
      inversions: 0,
      displayedLag: ordered.some((post) => annotate.has(post)),
      sequenceGaps: 0,
      ordered,
      annotate,
    };
  }

  // sequenceNum is the receipt-order index assigned by the queried ship, so
  // sorting by it is receipt order (a total order — no tie-breaks needed).
  const bySequence = [...posts].sort(
    (a, b) => (a.sequenceNum as number) - (b.sequenceNum as number)
  );

  let inversions = 0;
  // Real (non-stub) posts walked so far, for annotating every post a dip
  // displaces, not just the running maximum.
  const seen: Post[] = [];
  let maxSentAt: number | null = null;
  for (const post of bySequence) {
    // Gap-fill stubs carry synthetic sent times (previous + 1ms); they stay
    // in the displayed ordering but must not create or absorb inversions.
    if (post.isSequenceStub) {
      continue;
    }
    if (
      maxSentAt !== null &&
      maxSentAt - post.sentAt > INVERSION_TOLERANCE_MS
    ) {
      inversions += 1;
      // Mark the dipped post and every earlier post it dipped under, where a
      // receipt time exists to display.
      if (receipts.get(post) !== null) {
        annotate.add(post);
      }
      for (const earlier of seen) {
        if (
          !annotate.has(earlier) &&
          earlier.sentAt - post.sentAt > INVERSION_TOLERANCE_MS &&
          receipts.get(earlier) !== null
        ) {
          annotate.add(earlier);
        }
      }
    }
    seen.push(post);
    if (maxSentAt === null || post.sentAt > maxSentAt) {
      maxSentAt = post.sentAt;
    }
  }

  let ordered = inversions > 0 ? bySequence : sortBySentAt(posts);
  if (displayLimit !== undefined && posts.length > displayLimit) {
    const probe = bySequence[0];
    ordered = ordered.filter((post) => post !== probe);
  }
  const displayedSeqs = ordered.map((post) => post.sequenceNum as number);
  const sequenceGaps =
    displayedSeqs.length === 0
      ? 0
      : Math.max(...displayedSeqs) -
        Math.min(...displayedSeqs) +
        1 -
        displayedSeqs.length;
  return {
    eligible,
    inversions,
    displayedLag: ordered.some((post) => annotate.has(post)),
    sequenceGaps,
    ordered,
    annotate,
  };
}

// Whether the displayed window contains the requested target post — a
// context window centers its %around cursor in receipt-key space, so a
// late-delivered target (receipt position far from its sent-time id) can
// land entirely outside the returned page.
export function windowContainsPost(posts: Post[], postId: string): boolean {
  return posts.some((post) => post.id === postId);
}

// Warning text for a window; null when nothing suggests missing messages.
// Inversions prove receipt/sent disagreement. Material lag without inversions
// is the safety net for a delivery burst wider than the fetched page (probe
// included): every post's receipt diverges from its sent time (late delivery
// or clock skew) but the page is internally ordered, and only a post beyond
// the boundary could prove the skew — so a truncated page warns on the
// divergence alone, with direction-neutral wording. A complete page cannot be missing anything.
export function windowWarning(
  inversions: number,
  truncated: boolean,
  materialLag = false
): string | null {
  if (inversions > 0) {
    if (truncated) {
      return '⚠ receipt order ≠ sent order in this window: messages sent within this span may be missing — increase --limit to verify.';
    }
    return '⚠ receipt order ≠ sent order in this span (late-delivered messages are marked with "received" where receipt times are available).';
  }
  if (truncated && materialLag) {
    return '⚠ sent and received times diverge materially in this window: messages sent within this span may fall outside it — increase --limit to verify.';
  }
  return null;
}
