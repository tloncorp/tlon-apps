import type { Post } from '@tloncorp/api';
import { describe, expect, it } from 'bun:test';

import {
  INVERSION_TOLERANCE_MS,
  RECEIPT_LAG_NOTE_MS,
  analyzeWindow,
  hasReceiptOrder,
  receiptProxyMs,
  receiptTimeMs,
  udToUnixMs,
  windowContainsPost,
  windowFromPage,
  windowWarning,
} from './messages-runtime';

const T0 = 1_750_000_000_000;
const HOUR = 60 * 60 * 1000;

const LIMIT_WARNING =
  '⚠ receipt order ≠ sent order in this window: messages sent within this span may be missing — increase --limit to verify.';
const LAG_WARNING =
  '⚠ sent and received times diverge materially in this window: messages sent within this span may fall outside it — increase --limit to verify.';
const NEUTRAL_WARNING =
  '⚠ receipt order ≠ sent order in this span (late-delivered messages are marked with "received" where receipt times are available).';

const DA_SECOND = BigInt('18446744073709551616');
const DA_UNIX_EPOCH = BigInt('170141184475152167957503069145530368000');

// Inverse of the runtime's @da conversion; renders a dot-separated decimal ud
// so fixtures carry the same shape as live backendTime values.
function unixMsToUd(unixMs: number): string {
  const offset = DA_SECOND / BigInt(2000);
  const daNum =
    DA_UNIX_EPOCH - offset + (BigInt(unixMs) * DA_SECOND) / BigInt(1000);
  return daNum.toString(10).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function makePost(fields: {
  id: string;
  sentAt: number;
  sequenceNum?: number | null;
  backendTime?: string | null;
  authorId?: string;
  parentId?: string | null;
  isDeleted?: boolean;
  isSequenceStub?: boolean;
  channelId?: string;
  receivedAt?: number;
}): Post {
  return {
    type: 'chat',
    channelId: '~sampel-palnet',
    authorId: fields.authorId ?? '~sampel-palnet',
    receivedAt: fields.receivedAt ?? fields.sentAt,
    ...fields,
  };
}

function ids(posts: Post[]): string[] {
  return posts.map((post) => post.id);
}

// The annotation set is keyed by post object identity (client ids are not
// unique across authors); compare by id where fixtures keep ids distinct.
function annotatedIds(analysis: { annotate: Set<Post> }): Set<string> {
  return new Set([...analysis.annotate].map((post) => post.id));
}

describe('messages runtime', () => {
  it('1. keeps sentAt order for a clean interleaved DM window', () => {
    const p1 = makePost({
      id: 'writ-10',
      sentAt: T0,
      sequenceNum: 10,
      backendTime: unixMsToUd(T0 + 500),
      authorId: '~ravmel-ropdyl',
    });
    const p2 = makePost({
      id: 'writ-11',
      sentAt: T0 + 60_000,
      sequenceNum: 11,
      backendTime: unixMsToUd(T0 + 60_800),
      authorId: '~pinser-botter-ravmel-ropdyl',
    });
    const p3 = makePost({
      id: 'writ-12',
      sentAt: T0 + 120_000,
      sequenceNum: 12,
      backendTime: unixMsToUd(T0 + 120_300),
      authorId: '~ravmel-ropdyl',
    });
    const p4 = makePost({
      id: 'writ-13',
      sentAt: T0 + 120_000,
      sequenceNum: 13,
      backendTime: unixMsToUd(T0 + 121_000),
      authorId: '~pinser-botter-ravmel-ropdyl',
    });

    // Shuffled input; p3/p4 share sentAt, so a stable sort must keep p3
    // before p4 (their input order).
    const analysis = analyzeWindow([p2, p1, p3, p4], { truncated: true });

    expect(analysis.eligible).toBe(true);
    expect(analysis.inversions).toBe(0);
    expect(ids(analysis.ordered)).toEqual([
      'writ-10',
      'writ-11',
      'writ-12',
      'writ-13',
    ]);
    expect(analysis.annotate.size).toBe(0);
    expect(windowWarning(analysis.inversions, true)).toBeNull();
  });

  it('2. reorders the incident-shaped window by seq and annotates it', () => {
    // Owner writ received promptly; seven bot writs delivered in one burst
    // ~10 minutes after the owner writ, 9-18h after their sent times
    // (seqs 1656-1663 of the forensic data).
    const burstAt = T0 + 600_000;
    const owner = makePost({
      id: 'writ-1656',
      sentAt: T0,
      sequenceNum: 1656,
      backendTime: unixMsToUd(T0 + 400),
      authorId: '~ravmel-ropdyl',
    });
    const bots: Post[] = [];
    for (let i = 0; i < 7; i++) {
      const sentAt = burstAt - (18 - 1.5 * i) * HOUR;
      bots.push(
        makePost({
          id: `writ-${1657 + i}`,
          sentAt,
          sequenceNum: 1657 + i,
          backendTime: unixMsToUd(burstAt + i * 300),
          authorId: '~pinser-botter-ravmel-ropdyl',
        })
      );
    }

    const analysis = analyzeWindow([owner, ...bots], { truncated: true });

    expect(analysis.eligible).toBe(true);
    expect(analysis.inversions).toBe(7);
    // Receipt (seq) order leads with the owner writ; sentAt order would put
    // it last since every bot sent time is older than the owner's.
    expect(ids(analysis.ordered)).toEqual([
      'writ-1656',
      'writ-1657',
      'writ-1658',
      'writ-1659',
      'writ-1660',
      'writ-1661',
      'writ-1662',
      'writ-1663',
    ]);
    expect(annotatedIds(analysis)).toEqual(
      new Set([
        'writ-1656',
        'writ-1657',
        'writ-1658',
        'writ-1659',
        'writ-1660',
        'writ-1661',
        'writ-1662',
        'writ-1663',
      ])
    );
    expect(windowWarning(analysis.inversions, true)).toBe(LIMIT_WARNING);
  });

  it('3. handles group-channel shapes without backendTime', () => {
    const nest = 'chat/~host/general';
    const clean = [
      makePost({ id: 'post-1', sentAt: T0, sequenceNum: 1, channelId: nest }),
      makePost({
        id: 'post-2',
        sentAt: T0 + 60_000,
        sequenceNum: 2,
        channelId: nest,
      }),
      makePost({
        id: 'post-3',
        sentAt: T0 + 120_000,
        sequenceNum: 3,
        channelId: nest,
      }),
    ];
    const cleanAnalysis = analyzeWindow(clean, { truncated: false });
    expect(cleanAnalysis.eligible).toBe(true);
    expect(cleanAnalysis.inversions).toBe(0);
    expect(ids(cleanAnalysis.ordered)).toEqual(['post-1', 'post-2', 'post-3']);
    expect(cleanAnalysis.annotate.size).toBe(0);

    // A forged old sentAt at a new host sequence is the same lie as a skewed
    // DM writ. Group posts carry no backendTime, but their receivedAt is the
    // host arrival key, so inversion participants still get receipt display.
    const forged = [
      makePost({
        id: 'post-1',
        sentAt: T0 + 100_000,
        sequenceNum: 1,
        channelId: nest,
        receivedAt: T0 + 1_000,
      }),
      makePost({
        id: 'post-2',
        sentAt: T0,
        sequenceNum: 2,
        channelId: nest,
        receivedAt: T0 + 2_000,
      }),
      makePost({
        id: 'post-3',
        sentAt: T0 + 200_000,
        sequenceNum: 3,
        channelId: nest,
        receivedAt: T0 + 3_000,
      }),
    ];
    const forgedAnalysis = analyzeWindow(forged, { truncated: true });
    expect(forgedAnalysis.eligible).toBe(true);
    expect(forgedAnalysis.inversions).toBe(1);
    expect(ids(forgedAnalysis.ordered)).toEqual(['post-1', 'post-2', 'post-3']);
    expect(annotatedIds(forgedAnalysis)).toEqual(new Set(['post-1', 'post-2']));
    expect(windowWarning(forgedAnalysis.inversions, true)).toBe(LIMIT_WARNING);
    expect(windowWarning(forgedAnalysis.inversions, false)).toBe(
      NEUTRAL_WARNING
    );
  });

  it('4. orders a tombstone amid live writs by seq without annotating it', () => {
    const live1 = makePost({
      id: 'writ-1',
      sentAt: T0,
      sequenceNum: 1,
      backendTime: unixMsToUd(T0),
    });
    const tombstone = makePost({
      id: 'writ-2',
      sentAt: T0 - 10 * HOUR,
      sequenceNum: 2,
      isDeleted: true,
    });
    const live2 = makePost({
      id: 'writ-3',
      sentAt: T0 + 300_000,
      sequenceNum: 3,
      backendTime: unixMsToUd(T0 + 300_500),
    });

    const analysis = analyzeWindow([live1, tombstone, live2], {
      truncated: true,
    });

    expect(analysis.eligible).toBe(true);
    expect(analysis.inversions).toBe(1);
    expect(ids(analysis.ordered)).toEqual(['writ-1', 'writ-2', 'writ-3']);
    // The tombstone dips under the running max but has no receipt time to
    // display, so only the running-max post is annotated.
    expect(annotatedIds(analysis)).toEqual(new Set(['writ-1']));
  });

  it('5. keeps a sequence stub between its neighbors in the skewed path', () => {
    const before = makePost({
      id: 'writ-1',
      sentAt: T0,
      sequenceNum: 1,
      backendTime: unixMsToUd(T0),
    });
    const stub = makePost({
      id: 'stub-2',
      sentAt: T0 + 1,
      sequenceNum: 2,
      isSequenceStub: true,
    });
    const after = makePost({
      id: 'writ-3',
      sentAt: T0 - 11 * HOUR,
      sequenceNum: 3,
      backendTime: unixMsToUd(T0 + 600_000),
    });

    const analysis = analyzeWindow([before, stub, after], { truncated: true });

    expect(analysis.eligible).toBe(true);
    expect(analysis.inversions).toBe(1);
    // A sentAt sort would move the synthetic stub to the end; seq order keeps
    // it between its neighbors.
    expect(ids(analysis.ordered)).toEqual(['writ-1', 'stub-2', 'writ-3']);
    expect(annotatedIds(analysis).has('writ-3')).toBe(true);
    expect(annotatedIds(analysis).has('stub-2')).toBe(false);
  });

  it('6. leaves ineligible lists on sentAt order without warnings', () => {
    const skewed = [
      makePost({
        id: 'writ-1',
        sentAt: T0,
        sequenceNum: 1,
        backendTime: unixMsToUd(T0),
      }),
      makePost({
        id: 'writ-2',
        sentAt: T0 - 8 * HOUR,
        sequenceNum: 2,
        backendTime: unixMsToUd(T0 + 600_000),
      }),
    ];

    // No window opt-in (search/post shape): even an all-writ page never
    // reorders, but lag annotations still apply.
    const noOptIn = analyzeWindow(skewed);
    expect(noOptIn.eligible).toBe(false);
    expect(noOptIn.inversions).toBe(0);
    expect(ids(noOptIn.ordered)).toEqual(['writ-2', 'writ-1']);
    expect(annotatedIds(noOptIn)).toEqual(new Set(['writ-2']));
    expect(windowWarning(noOptIn.inversions, true)).toBeNull();

    // Replies present (dummy seq 0).
    const withReply = analyzeWindow(
      [
        makePost({ id: 'writ-5', sentAt: T0, sequenceNum: 5 }),
        makePost({
          id: 'reply-1',
          sentAt: T0 - HOUR,
          sequenceNum: 0,
          parentId: 'writ-5',
          backendTime: unixMsToUd(T0 - HOUR + 600_000),
        }),
      ],
      { truncated: true }
    );
    expect(withReply.eligible).toBe(false);
    expect(withReply.inversions).toBe(0);
    expect(ids(withReply.ordered)).toEqual(['reply-1', 'writ-5']);
    expect(annotatedIds(withReply)).toEqual(new Set(['reply-1']));
    expect(windowWarning(withReply.inversions, true)).toBeNull();

    // Missing seq.
    const missingSeq = analyzeWindow(
      [
        makePost({ id: 'writ-3', sentAt: T0, sequenceNum: 3 }),
        makePost({
          id: 'writ-4',
          sentAt: T0 - HOUR,
          sequenceNum: null,
          backendTime: unixMsToUd(T0 - HOUR + 600_000),
        }),
      ],
      { truncated: true }
    );
    expect(missingSeq.eligible).toBe(false);
    expect(missingSeq.inversions).toBe(0);
    expect(ids(missingSeq.ordered)).toEqual(['writ-4', 'writ-3']);
    expect(annotatedIds(missingSeq)).toEqual(new Set(['writ-4']));
    expect(windowWarning(missingSeq.inversions, false)).toBeNull();

    // Duplicate seq (a %egg-any-restored club pact is not renumbered): the
    // comparator would tie and fall back to sent-derived input order, so the
    // page has no usable receipt order.
    const dupSeq = [
      makePost({ id: 'writ-6', sentAt: T0, sequenceNum: 6 }),
      makePost({ id: 'writ-6b', sentAt: T0 - HOUR, sequenceNum: 6 }),
    ];
    expect(hasReceiptOrder(dupSeq)).toBe(false);
    const dupAnalysis = analyzeWindow(dupSeq, { truncated: true });
    expect(dupAnalysis.eligible).toBe(false);
    expect(ids(dupAnalysis.ordered)).toEqual(['writ-6b', 'writ-6']);
  });

  it('7. treats exact tolerance and lag boundaries as documented', () => {
    const window = { truncated: true };

    // A dip of exactly INVERSION_TOLERANCE_MS is jitter, not an inversion;
    // one millisecond more is.
    const atTolerance = analyzeWindow(
      [
        makePost({ id: 'writ-1', sentAt: T0, sequenceNum: 1 }),
        makePost({
          id: 'writ-2',
          sentAt: T0 - INVERSION_TOLERANCE_MS,
          sequenceNum: 2,
        }),
      ],
      window
    );
    expect(atTolerance.inversions).toBe(0);
    expect(ids(atTolerance.ordered)).toEqual(['writ-2', 'writ-1']);

    const pastTolerance = analyzeWindow(
      [
        makePost({ id: 'writ-1', sentAt: T0, sequenceNum: 1 }),
        makePost({
          id: 'writ-2',
          sentAt: T0 - INVERSION_TOLERANCE_MS - 1,
          sequenceNum: 2,
        }),
      ],
      window
    );
    expect(pastTolerance.inversions).toBe(1);
    expect(ids(pastTolerance.ordered)).toEqual(['writ-1', 'writ-2']);

    // Lag of exactly RECEIPT_LAG_NOTE_MS is not annotated; one ms more is.
    const atLag = analyzeWindow(
      [
        makePost({
          id: 'writ-1',
          sentAt: T0,
          sequenceNum: 1,
          backendTime: unixMsToUd(T0 + RECEIPT_LAG_NOTE_MS),
        }),
      ],
      window
    );
    expect(atLag.annotate.size).toBe(0);

    // The @da conversion floors sub-millisecond remainders, so encode one ms
    // more than the boundary plus the remainder that floors away: the
    // converted lag lands exactly one ms past RECEIPT_LAG_NOTE_MS.
    const pastLag = analyzeWindow(
      [
        makePost({
          id: 'writ-1',
          sentAt: T0,
          sequenceNum: 1,
          backendTime: unixMsToUd(T0 + RECEIPT_LAG_NOTE_MS + 2),
        }),
      ],
      window
    );
    expect(annotatedIds(pastLag)).toEqual(new Set(['writ-1']));

    // Negative lag (sender clock ahead of receiver) is a divergence too.
    const negativeLag = analyzeWindow(
      [
        makePost({
          id: 'writ-1',
          sentAt: T0,
          sequenceNum: 1,
          backendTime: unixMsToUd(T0 - 10 * 60_000),
        }),
      ],
      window
    );
    expect(annotatedIds(negativeLag)).toEqual(new Set(['writ-1']));
  });

  it('8. orders deterministically under shared receipt/sent milliseconds', () => {
    const sharedReceipt = unixMsToUd(T0 + 600_000);
    const a = makePost({
      id: 'writ-1',
      sentAt: T0,
      sequenceNum: 1,
      backendTime: sharedReceipt,
      authorId: '~ravmel-ropdyl',
    });
    const b = makePost({
      id: 'writ-2',
      sentAt: T0,
      sequenceNum: 2,
      backendTime: sharedReceipt,
      authorId: '~pinser-botter-ravmel-ropdyl',
    });
    const c = makePost({
      id: 'writ-3',
      sentAt: T0 - HOUR,
      sequenceNum: 3,
      backendTime: sharedReceipt,
      authorId: '~ravmel-ropdyl',
    });

    // Input order differs from seq order; two posts share sentAt and all
    // three share a receipt millisecond, yet seq is a total order.
    const first = analyzeWindow([b, a, c], { truncated: true });
    const second = analyzeWindow([b, a, c], { truncated: true });
    expect(first.inversions).toBe(1);
    expect(ids(first.ordered)).toEqual(['writ-1', 'writ-2', 'writ-3']);
    expect(ids(second.ordered)).toEqual(ids(first.ordered));
  });

  it('9. treats malformed backendTime as annotation-less without throwing', () => {
    expect(udToUnixMs('not-a-da')).toBeNull();
    expect(udToUnixMs('')).toBeNull();
    expect(udToUnixMs('170.141.abc')).toBeNull();
    // Parseable by BigInt but implausible as a @da: out-of-era values must
    // read as unparseable, not as enormous receipt lag.
    expect(udToUnixMs('1')).toBeNull();
    expect(udToUnixMs('-1')).toBeNull();
    expect(udToUnixMs('999999999999999999999999999999999999999999')).toBeNull();
    // Non-@ud syntax that BigInt would otherwise parse (hex/octal/binary
    // prefixes, signs, whitespace) is rejected on shape, even when the
    // numeric value would land inside the supported era.
    expect(udToUnixMs('0x8000000d361293000000000000000000')).toBeNull();
    expect(udToUnixMs('+170141184508120246532342846161124589568')).toBeNull();
    expect(udToUnixMs(' 170141184508120246532342846161124589568')).toBeNull();
    // Both shapes the API actually produces still convert: canonical dotted
    // and raw undotted digits.
    expect(
      udToUnixMs('170141184508120246532342846161124589568')
    ).not.toBeNull();

    const malformed = makePost({
      id: 'writ-2',
      sentAt: T0 - 2 * HOUR,
      sequenceNum: 2,
      backendTime: 'garbage',
    });
    expect(receiptTimeMs(malformed)).toBeNull();

    const analysis = analyzeWindow(
      [
        makePost({
          id: 'writ-1',
          sentAt: T0,
          sequenceNum: 1,
          backendTime: unixMsToUd(T0),
        }),
        malformed,
      ],
      { truncated: true }
    );
    expect(analysis.inversions).toBe(1);
    expect(ids(analysis.ordered)).toEqual(['writ-1', 'writ-2']);
    expect(annotatedIds(analysis)).toEqual(new Set(['writ-1']));
  });

  it('10. picks window warning text by skew, truncation, and lag', () => {
    expect(windowWarning(1, true)).toBe(LIMIT_WARNING);
    expect(windowWarning(3, false)).toBe(NEUTRAL_WARNING);
    expect(windowWarning(0, true)).toBeNull();
    expect(windowWarning(0, false)).toBeNull();
    // Lag safety net: no provable inversion, but a truncated page whose
    // messages arrived far from their sent times may hide in-span messages
    // beyond the boundary. A complete page cannot be missing anything.
    expect(windowWarning(0, true, true)).toBe(LAG_WARNING);
    expect(windowWarning(0, false, true)).toBeNull();
    // Inversions outrank the lag net regardless of the lag flag.
    expect(windowWarning(2, true, true)).toBe(LIMIT_WARNING);
  });

  it('11. treats a page as truncated when either cursor is present', () => {
    // An `around` page (context command) can be complete on the older edge
    // while messages still exist beyond the newer one — that window can
    // exclude in-span messages, so it must get the --limit warning.
    expect(windowFromPage({ older: '123', newer: null })).toEqual({
      truncated: true,
    });
    expect(windowFromPage({ older: null, newer: '456' })).toEqual({
      truncated: true,
    });
    expect(windowFromPage({ older: '123', newer: '456' })).toEqual({
      truncated: true,
    });
    expect(windowFromPage({ older: null, newer: null })).toEqual({
      truncated: false,
    });
    expect(windowFromPage({})).toEqual({ truncated: false });

    // Overfetch counts as truncation only when receipt order lets the probe
    // be trimmed; an ineligible N+1 page with no cursors displays everything
    // and is genuinely complete.
    const eligiblePage = [
      makePost({ id: 'writ-1', sentAt: T0, sequenceNum: 1 }),
      makePost({ id: 'writ-2', sentAt: T0 + 1, sequenceNum: 2 }),
    ];
    const ineligiblePage = [
      makePost({ id: 'writ-1', sentAt: T0, sequenceNum: null }),
      makePost({ id: 'writ-2', sentAt: T0 + 1, sequenceNum: 2 }),
    ];
    expect(
      windowFromPage({ older: null, newer: null, posts: eligiblePage }, 1)
    ).toEqual({ truncated: true });
    expect(
      windowFromPage({ older: null, newer: null, posts: ineligiblePage }, 1)
    ).toEqual({ truncated: false });
    expect(
      windowFromPage({ older: 'x', newer: null, posts: ineligiblePage }, 1)
    ).toEqual({ truncated: true });
  });

  it('12. annotates by post identity when client ids collide', () => {
    // DM client ids strip the author prefix, so two participants claiming
    // the same sent millisecond share an id. Only the late-received post may
    // carry the (received ...) note.
    const sharedId = '170.100.200';
    const prompt = makePost({
      id: sharedId,
      sentAt: T0,
      sequenceNum: 1,
      backendTime: unixMsToUd(T0 + 200),
      authorId: '~ravmel-ropdyl',
    });
    const late = makePost({
      id: sharedId,
      sentAt: T0,
      sequenceNum: 2,
      backendTime: unixMsToUd(T0 + 10 * 60_000),
      authorId: '~pinser-botter-ravmel-ropdyl',
    });

    const analysis = analyzeWindow([prompt, late], { truncated: true });

    expect(analysis.annotate.size).toBe(1);
    expect(analysis.annotate.has(late)).toBe(true);
    expect(analysis.annotate.has(prompt)).toBe(false);
  });

  it('13. boundary probe detects skew wider than the window', () => {
    // Incident shape at --limit 6: the fetched page (limit+1 = 7) is six
    // late-flushed bot writs plus the probe — the receipt-older owner writ
    // whose sent time is NEWER than every bot sent time. Without the probe
    // the six bot writs are internally sent-ordered (zero inversions) and
    // the misleading window would print unwarned.
    const probe = makePost({
      id: 'writ-1656',
      sentAt: T0,
      sequenceNum: 1656,
      backendTime: unixMsToUd(T0 + 400),
      authorId: '~ravmel-ropdyl',
    });
    const bots: Post[] = [];
    for (let i = 0; i < 6; i++) {
      bots.push(
        makePost({
          id: `writ-${1657 + i}`,
          sentAt: T0 - (16 - 2 * i) * HOUR,
          sequenceNum: 1657 + i,
          backendTime: unixMsToUd(T0 + 600_000 + i * 300),
          authorId: '~pinser-botter-ravmel-ropdyl',
        })
      );
    }

    // Without the probe there are no inversions to prove the skew — but the
    // lag safety net still warns: this is also the burst-wider-than-limit
    // shape, where even the probe would sit inside the burst.
    const unprobed = analyzeWindow(bots, { truncated: true });
    expect(unprobed.inversions).toBe(0);
    expect(unprobed.annotate.size).toBeGreaterThan(0);
    expect(unprobed.displayedLag).toBe(true);
    expect(
      windowWarning(unprobed.inversions, true, unprobed.displayedLag)
    ).toBe(LAG_WARNING);

    const analysis = analyzeWindow([probe, ...bots], { truncated: true }, 6);
    expect(analysis.inversions).toBe(6);
    // The probe is analysis-only: display holds exactly the requested six.
    expect(ids(analysis.ordered)).toEqual([
      'writ-1657',
      'writ-1658',
      'writ-1659',
      'writ-1660',
      'writ-1661',
      'writ-1662',
    ]);
    expect(windowWarning(analysis.inversions, true)).toBe(LIMIT_WARNING);

    // Clean thread: the probe trims silently and order is unchanged.
    const clean = [0, 1, 2, 3].map((i) =>
      makePost({
        id: `writ-${i + 1}`,
        sentAt: T0 + i * 60_000,
        sequenceNum: i + 1,
        backendTime: unixMsToUd(T0 + i * 60_000 + 300),
      })
    );
    const cleanAnalysis = analyzeWindow(clean, { truncated: true }, 3);
    expect(cleanAnalysis.inversions).toBe(0);
    expect(ids(cleanAnalysis.ordered)).toEqual(['writ-2', 'writ-3', 'writ-4']);

    // A page at or under the requested size trims nothing.
    const short = analyzeWindow(clean.slice(0, 2), { truncated: false }, 5);
    expect(ids(short.ordered)).toEqual(['writ-1', 'writ-2']);

    // A lagged probe with a clean displayed window must not warn: the probe
    // stays in `annotate` after trimming, but the lag flag only considers
    // displayed posts.
    const lagged = makePost({
      id: 'probe-10',
      sentAt: T0 - 10 * HOUR,
      sequenceNum: 10,
      backendTime: unixMsToUd(T0 - 10 * HOUR + 6 * 60_000),
    });
    const cleanTail = [0, 1, 2].map((i) =>
      makePost({
        id: `writ-${11 + i}`,
        sentAt: T0 + i * 60_000,
        sequenceNum: 11 + i,
        backendTime: unixMsToUd(T0 + i * 60_000 + 200),
      })
    );
    const probeOnlyLag = analyzeWindow(
      [lagged, ...cleanTail],
      {
        truncated: true,
      },
      3
    );
    expect(probeOnlyLag.inversions).toBe(0);
    expect(ids(probeOnlyLag.ordered)).toEqual([
      'writ-11',
      'writ-12',
      'writ-13',
    ]);
    expect(probeOnlyLag.annotate.size).toBe(1);
    expect(probeOnlyLag.displayedLag).toBe(false);
    expect(
      windowWarning(probeOnlyLag.inversions, true, probeOnlyLag.displayedLag)
    ).toBeNull();

    // Without receipt order the probe is unidentifiable: an overfetched
    // ineligible page displays everything rather than guessing what to drop
    // (trimming sent-oldest could drop a real message and keep the probe).
    const ineligible = [
      makePost({ id: 'writ-a', sentAt: T0, sequenceNum: null }),
      makePost({ id: 'writ-b', sentAt: T0 + 60_000, sequenceNum: 4 }),
      makePost({ id: 'writ-c', sentAt: T0 + 120_000, sequenceNum: 5 }),
    ];
    const untrimmed = analyzeWindow(ineligible, { truncated: true }, 2);
    expect(untrimmed.eligible).toBe(false);
    expect(untrimmed.ordered.length).toBe(3);
  });

  it('14. annotates every post displaced by a dip, not just the maximum', () => {
    // Sent times 10:00, 10:01, then a dip to 09:00: the dipped post inverts
    // against BOTH earlier posts, so both carry (received ...) context.
    const first = makePost({
      id: 'writ-1',
      sentAt: T0,
      sequenceNum: 1,
      backendTime: unixMsToUd(T0 + 100),
    });
    const second = makePost({
      id: 'writ-2',
      sentAt: T0 + 60_000,
      sequenceNum: 2,
      backendTime: unixMsToUd(T0 + 60_100),
    });
    const dipped = makePost({
      id: 'writ-3',
      sentAt: T0 - HOUR,
      sequenceNum: 3,
      backendTime: unixMsToUd(T0 + 120_000),
    });

    const analysis = analyzeWindow([first, second, dipped], {
      truncated: true,
    });

    expect(analysis.inversions).toBe(1);
    expect(annotatedIds(analysis)).toEqual(
      new Set(['writ-1', 'writ-2', 'writ-3'])
    );
  });

  it('15. keeps sequence stubs out of inversion detection', () => {
    // Real posts exactly INVERSION_TOLERANCE_MS apart are jitter, not skew.
    // A gap-fill stub between them carries a synthetic sentAt of previous
    // + 1ms; if it drove the running max, the tolerated gap would read as
    // tolerance + 1 and produce a false warning.
    const before = makePost({
      id: 'writ-1',
      sentAt: T0,
      sequenceNum: 1,
      backendTime: unixMsToUd(T0 + 100),
    });
    const stub = makePost({
      id: 'stub-2',
      sentAt: T0 + 1,
      sequenceNum: 2,
      isSequenceStub: true,
    });
    const after = makePost({
      id: 'writ-3',
      sentAt: T0 - INVERSION_TOLERANCE_MS,
      sequenceNum: 3,
      backendTime: unixMsToUd(T0 + 200),
    });

    const analysis = analyzeWindow([before, stub, after], { truncated: true });

    expect(analysis.inversions).toBe(0);
    // Zero inversions → clean sentAt ordering (the stub's synthetic time
    // places it after its sequence predecessor).
    expect(ids(analysis.ordered)).toEqual(['writ-3', 'writ-1', 'stub-2']);
  });

  it('16. flags a target absent from a context window', () => {
    const posts = [
      makePost({ id: '170.100', sentAt: T0, sequenceNum: 1 }),
      makePost({ id: '170.200', sentAt: T0 + 60_000, sequenceNum: 2 }),
    ];
    expect(windowContainsPost(posts, '170.200')).toBe(true);
    expect(windowContainsPost(posts, '170.999')).toBe(false);
    expect(windowContainsPost([], '170.999')).toBe(false);
  });

  it('17. property sweep: incident-shaped universe warns at every window size', () => {
    // Synthetic mirror of the forensic incident: interleaved prompt traffic,
    // then six owner writs answered by bot writs that all arrive in two late
    // flushes. Property: any displayed newest-window that omits a message
    // sent inside its own sent-time span must carry a warning.
    const universe: Post[] = [];
    let seq = 0;
    const add = (author: string, sentAt: number, receivedAt: number) => {
      seq += 1;
      universe.push(
        makePost({
          id: `writ-${seq}`,
          sentAt,
          sequenceNum: seq,
          backendTime: unixMsToUd(receivedAt),
          authorId: author,
        })
      );
    };
    // Prompt interleaved era: 8 exchanges, second-level lags.
    for (let i = 0; i < 8; i++) {
      add('~owner', T0 + i * HOUR, T0 + i * HOUR + 500);
      add('~bot', T0 + i * HOUR + 5_000, T0 + i * HOUR + 5_400);
    }
    const wedge = T0 + 8 * HOUR;
    // Wedge era: six owner writs land promptly; the bot's replies are sent
    // minutes later but only arrive in two flushes far in the future.
    const flush1 = wedge + 14 * HOUR;
    const flush2 = wedge + 19 * HOUR;
    add('~owner', wedge, wedge + 300);
    add('~bot', wedge + 60_000, flush1); // lone early flush
    for (let i = 1; i < 6; i++) {
      add('~owner', wedge + i * HOUR, wedge + i * HOUR + 300);
    }
    for (let i = 1; i < 6; i++) {
      add('~bot', wedge + i * HOUR + 60_000, flush2 + i * 1_000);
    }
    // Re-sequence in receipt order (mop order), as the ship stores them.
    const byReceipt = [...universe].sort(
      (a, b) => (receiptTimeMs(a) as number) - (receiptTimeMs(b) as number)
    );
    byReceipt.forEach((post, i) => {
      post.sequenceNum = i + 1;
    });

    for (let n = 1; n < byReceipt.length; n++) {
      const fetched = byReceipt.slice(-Math.min(n + 1, byReceipt.length));
      const window = windowFromPage(
        {
          older: fetched.length < byReceipt.length ? 'x' : null,
          newer: null,
          posts: fetched,
        },
        n
      );
      const analysis = analyzeWindow(fetched, window, n);
      const warning = windowWarning(
        analysis.inversions,
        window.truncated,
        analysis.displayedLag
      );
      const displayed = new Set(analysis.ordered);
      const lo = Math.min(...analysis.ordered.map((p) => p.sentAt));
      const hi = Math.max(...analysis.ordered.map((p) => p.sentAt));
      const missing = byReceipt.filter(
        (p) => !displayed.has(p) && p.sentAt >= lo && p.sentAt <= hi
      );
      if (missing.length > 0 && warning === null) {
        throw new Error(
          `guarantee defeated at --limit ${n}: ${missing.length} in-span ` +
            `posts omitted with no warning`
        );
      }
    }
  });

  it('18. lag net covers group channels via host receivedAt', () => {
    const nest = 'chat/~host/general';
    // Offline-composed burst: an author reconnects and the host sequences a
    // day of messages at arrival, claimed sent times intact. The window sits
    // entirely inside the burst — zero inversions — so only the lag net can
    // warn, and for group posts its receipt source is receivedAt.
    const burstAt = T0 + 24 * HOUR;
    const burst = [0, 1, 2].map((i) =>
      makePost({
        id: `post-${11 + i}`,
        sentAt: T0 + i * HOUR,
        sequenceNum: 11 + i,
        channelId: nest,
        receivedAt: burstAt + i * 1_000,
      })
    );
    expect(receiptProxyMs(burst[0])).toBe(burstAt);
    const analysis = analyzeWindow(burst, { truncated: true }, 3);
    expect(analysis.inversions).toBe(0);
    expect(analysis.displayedLag).toBe(true);
    expect(
      windowWarning(analysis.inversions, true, analysis.displayedLag)
    ).toBe(LAG_WARNING);

    // DM posts never use receivedAt as a receipt source: it is derived from
    // the sent-time id segment and carries no receipt information.
    const dmPost = makePost({
      id: 'writ-1',
      sentAt: T0,
      sequenceNum: 1,
      receivedAt: burstAt,
    });
    expect(receiptProxyMs(dmPost)).toBeNull();
  });

  it('19. reports sequence gaps in the displayed window', () => {
    const gapped = [
      makePost({ id: 'writ-10', sentAt: T0, sequenceNum: 10 }),
      makePost({ id: 'writ-12', sentAt: T0 + 60_000, sequenceNum: 12 }),
      makePost({ id: 'writ-13', sentAt: T0 + 120_000, sequenceNum: 13 }),
    ];
    const analysis = analyzeWindow(gapped, { truncated: true });
    expect(analysis.sequenceGaps).toBe(1);

    const contiguous = analyzeWindow(
      [
        makePost({ id: 'writ-1', sentAt: T0, sequenceNum: 1 }),
        makePost({ id: 'writ-2', sentAt: T0 + 60_000, sequenceNum: 2 }),
      ],
      { truncated: true }
    );
    expect(contiguous.sequenceGaps).toBe(0);

    // Ineligible pages have no sequence range to reason about.
    const ineligible = analyzeWindow(
      [makePost({ id: 'writ-1', sentAt: T0, sequenceNum: null })],
      { truncated: true }
    );
    expect(ineligible.sequenceGaps).toBe(0);
  });
});
