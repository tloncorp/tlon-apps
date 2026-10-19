import { afterEach, describe, expect, it } from 'vitest';

import { RESTART_REPLAY_WINDOW_MS } from './monitor/restart-replay.js';
import {
  OWNER_TOOL_POST_LIMIT,
  OWNER_TOOL_POST_TTL_MS,
  type OwnerToolPost,
  _testing,
  canonicalPostId,
  canonicalTarget,
  channelInboundPost,
  chatInboundPost,
  createOwnerToolPostLedger,
  isShortcodeReaction,
  sharedOwnerToolPostLedger,
} from './owner-tool-posts.js';
import { formatSentAt } from './urbit/send.js';

const T = 1_700_000_000_000;

function makeLedger() {
  let now = T;
  const ledger = createOwnerToolPostLedger({
    now: () => now,
    store: new Map(),
  });
  return {
    ledger,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

function send(
  sentAt: number,
  overrides: Partial<OwnerToolPost> = {}
): OwnerToolPost {
  return {
    kind: 'send',
    accountId: 'default',
    author: '~owner',
    target: 'chat/~h/c',
    sentAt,
    ...overrides,
  } as OwnerToolPost;
}

afterEach(() => {
  _testing.clear();
});

describe('owner tool post ledger', () => {
  it('matches a send at its sent time, one ms either side, and no further', () => {
    const { ledger } = makeLedger();
    ledger.reserve(send(T));
    for (const sent of [T - 1, T, T + 1]) {
      expect(
        ledger.match({ author: '~owner', target: 'chat/~h/c', sent })
      ).not.toBeNull();
    }
    for (const sent of [T - 2, T + 2]) {
      expect(
        ledger.match({ author: '~owner', target: 'chat/~h/c', sent })
      ).toBeNull();
    }
    expect(
      ledger.match({ author: '~other', target: 'chat/~h/c', sent: T })
    ).toBeNull();
  });

  it('ignores the target when the author is known', () => {
    const { ledger } = makeLedger();
    ledger.reserve(send(T));
    expect(
      ledger.match({ author: '~owner', target: 'chat/~x/y', sent: T })
    ).not.toBeNull();
  });

  it('requires the canonical target when no author was recorded', () => {
    const { ledger } = makeLedger();
    ledger.reserve(send(T, { author: null, target: 'chat/zod/c' }));
    ledger.reserve(send(T + 10, { author: null, target: '0V1.ABC' }));
    expect(
      ledger.match({ author: '~any', target: 'chat/~zod/c', sent: T })
    ).not.toBeNull();
    expect(
      ledger.match({ author: '~any', target: 'chat/~zod/d', sent: T })
    ).toBeNull();
    expect(
      ledger.match({ author: '~any', target: '0v1.abc', sent: T + 10 })
    ).not.toBeNull();
    expect(
      ledger.match({ author: '~any', target: '0v1.abd', sent: T + 10 })
    ).toBeNull();
  });

  it('matches a wildcard-author DM to a ship at the receiving bot, not the partner', () => {
    // Account A (bot ~nec) ran `--config /b-owner.json posts send ~bus
    // "/restart"`: the author is unverified, the target is the recipient.
    const { ledger } = makeLedger();
    ledger.reserve(send(T, { author: null, target: 'bus' }));
    // Account B is bot ~bus, owned by ~zod. Its firehose names the DM by the
    // partner, which is the sender.
    const atB = { author: '~zod', target: '~zod', receivingShip: '~bus' };
    expect(ledger.match({ ...atB, sent: T })).not.toBeNull();
    expect(
      ledger.match({ ...atB, postId: `~zod/${formatSentAt(T)}` })
    ).not.toBeNull();
    // The owner typing to B at another time is still the owner.
    expect(ledger.match({ ...atB, sent: T + 5 })).toBeNull();
    expect(
      ledger.match({ ...atB, postId: `~zod/${formatSentAt(T + 5)}` })
    ).toBeNull();
    // Another bot whose DM partner happens to be ~bus is not the recipient.
    expect(
      ledger.match({
        author: '~bus',
        target: '~bus',
        receivingShip: '~nec',
        sent: T,
      })
    ).toBeNull();
    // Without a receiving ship there is nothing to compare against.
    expect(
      ledger.match({ author: '~zod', target: '~zod', sent: T })
    ).toBeNull();
  });

  it('compares a wildcard-author ship target with the receiving bot only for a one-to-one DM', () => {
    const { ledger } = makeLedger();
    ledger.reserve(send(T, { author: null, target: '~bus' }));
    // A club or channel post that reaches ~bus is not a DM to ~bus.
    for (const target of ['0v1.abc', 'chat/~bus/c']) {
      expect(
        ledger.match({
          author: '~zod',
          target,
          receivingShip: '~bus',
          sent: T,
        }),
        target
      ).toBeNull();
    }
    expect(
      ledger.match({
        author: '~zod',
        target: '~zod',
        receivingShip: '~bus',
        sent: T,
      })
    ).not.toBeNull();
  });

  it('matches a writ or DM reply id derived from the sent time, without sent', () => {
    const { ledger } = makeLedger();
    ledger.reserve(send(T, { target: '0v1.abc' }));
    const id = `~owner/${formatSentAt(T)}`;
    expect(
      ledger.match({ author: '~owner', target: '0v1.abc', postId: id })
    ).not.toBeNull();
    expect(
      ledger.match({
        author: '~owner',
        target: '0v1.abc',
        postId: id,
        sent: T + 50,
      })
    ).not.toBeNull();
    expect(
      ledger.match({
        author: '~owner',
        target: '0v1.abc',
        postId: `~owner/${formatSentAt(T + 50)}`,
      })
    ).toBeNull();
    // A channel post id is host-assigned: only writ ids carry an author.
    expect(
      ledger.match({
        author: '~owner',
        target: 'chat/~h/c',
        postId: formatSentAt(T),
      })
    ).toBeNull();
  });

  it('matches edits by post id in any spelling, and by parent', () => {
    const { ledger } = makeLedger();
    ledger.reserve({
      kind: 'edit',
      accountId: 'default',
      author: '~owner',
      target: 'chat/~h/c',
      postId: canonicalPostId('170.141.184'),
    });
    ledger.reserve({
      kind: 'edit',
      accountId: 'default',
      author: '~owner',
      target: 'chat/~h/c',
      postId: canonicalPostId('170.2'),
      parentId: canonicalPostId('170.1'),
    });
    for (const postId of ['170.141.184', '170141184', '~owner/170.141.184']) {
      expect(
        ledger.match({ author: '~owner', target: 'chat/~h/c', postId })
      ).not.toBeNull();
    }
    expect(
      ledger.match({ author: '~x', target: 'chat/~h/c', postId: '170141184' })
    ).toBeNull();
    expect(
      ledger.match({
        author: '~owner',
        target: 'chat/~h/c',
        postId: '1702',
        parentId: '170.1',
      })
    ).not.toBeNull();
    expect(
      ledger.match({
        author: '~owner',
        target: 'chat/~h/c',
        postId: '170.2',
        parentId: '170.9',
      })
    ).toBeNull();
    expect(
      ledger.match({ author: '~owner', target: 'chat/~h/c', postId: '170.2' })
    ).toBeNull();
  });

  it('matches reactions only as reactions, by post id and reaction', () => {
    const { ledger } = makeLedger();
    ledger.reserve({
      kind: 'react',
      accountId: 'default',
      author: '~owner',
      target: 'chat/~h/c',
      postId: '170141',
      reaction: '👍',
    });
    ledger.reserve(send(T));
    const reaction = {
      author: '~owner',
      target: 'chat/~h/c',
      postId: '170.141',
    };
    expect(ledger.match({ ...reaction, reaction: '👍' })).toMatchObject({
      kind: 'react',
    });
    expect(ledger.match({ ...reaction, reaction: '👎' })).toBeNull();
    expect(ledger.match(reaction)).toBeNull();
    // A reaction never matches a send recorded at the same time.
    expect(ledger.match({ ...reaction, sent: T, reaction: '❤️' })).toBeNull();
  });

  it('matches a :shortcode: reaction on author and post alone, which the desk turns into Unicode', () => {
    const cases = [
      // channel post, channel reply, DM writ
      { target: 'chat/~h/c', postId: '170141', inboundId: '170.141' },
      { target: 'chat/~h/c', postId: '170142', inboundId: '170.142' },
      {
        target: '~alice',
        postId: canonicalPostId(`~alice/${formatSentAt(T)}`),
        inboundId: `~alice/${formatSentAt(T)}`,
      },
    ];
    for (const { target, postId, inboundId } of cases) {
      const { ledger } = makeLedger();
      ledger.reserve({
        kind: 'react',
        accountId: 'default',
        author: '~owner',
        target,
        postId,
        reaction: ':grinning:',
      });
      const inbound = { author: '~owner', target, postId: inboundId };
      expect(
        ledger.match({ ...inbound, reaction: '😀' }),
        target
      ).toMatchObject({ kind: 'react' });
      expect(
        ledger.match({ ...inbound, reaction: ':grinning:' })
      ).not.toBeNull();
      expect(
        ledger.match({ ...inbound, author: '~alice', reaction: '😀' })
      ).toBeNull();
      expect(
        ledger.match({ ...inbound, postId: '170.9', reaction: '😀' })
      ).toBeNull();
      expect(ledger.match(inbound)).toBeNull();
    }
  });

  it('recognizes every shortcode form the desk converts', () => {
    // +kill:emojimart: `:name:` or `::name::`, optional `:skin-tone-N:`.
    for (const reaction of [
      ':thumbsup:',
      '::+1::',
      ':+1::skin-tone-2:',
      '::+1:::skin-tone-6:',
    ]) {
      expect(isShortcodeReaction(reaction), reaction).toBe(true);
    }
    for (const reaction of [
      'grinning',
      ':grin ning:',
      '::',
      '👍',
      ':+1::skin-tone-7:',
      ':+1:skin-tone-2:',
      ':::+1:::',
    ]) {
      expect(isShortcodeReaction(reaction), reaction).toBe(false);
    }

    const { ledger } = makeLedger();
    ledger.reserve({
      kind: 'react',
      accountId: 'default',
      author: '~owner',
      target: 'chat/~h/c',
      postId: '170141',
      reaction: '::+1::',
    });
    expect(
      ledger.match({
        author: '~owner',
        target: 'chat/~h/c',
        postId: '170.141',
        reaction: '👍',
      })
    ).toMatchObject({ kind: 'react' });
  });

  it('still requires the exact reaction when it is not a :shortcode:', () => {
    for (const reaction of ['grinning', ':grin ning:', '::', '😀']) {
      const { ledger } = makeLedger();
      ledger.reserve({
        kind: 'react',
        accountId: 'default',
        author: '~owner',
        target: 'chat/~h/c',
        postId: '170141',
        reaction,
      });
      const inbound = {
        author: '~owner',
        target: 'chat/~h/c',
        postId: '170.141',
      };
      expect(ledger.match({ ...inbound, reaction }), reaction).not.toBeNull();
      expect(ledger.match({ ...inbound, reaction: '👍' }), reaction).toBeNull();
    }
  });

  it('keeps entries for the TTL, which outlasts restart replay', () => {
    expect(OWNER_TOOL_POST_TTL_MS).toBeGreaterThan(RESTART_REPLAY_WINDOW_MS);
    const { ledger, advance } = makeLedger();
    ledger.reserve(send(T));
    const inbound = { author: '~owner', target: 'chat/~h/c', sent: T };
    advance(5 * 60 * 60_000 + 59 * 60_000);
    expect(ledger.match(inbound)).not.toBeNull();
    advance(OWNER_TOOL_POST_TTL_MS - (5 * 60 * 60_000 + 59 * 60_000));
    expect(ledger.match(inbound)).not.toBeNull();
    advance(1);
    expect(ledger.match(inbound)).toBeNull();
  });

  it('refuses a reservation past the limit instead of evicting, per account', () => {
    const store = new Map();
    let now = T;
    const ledger = createOwnerToolPostLedger({ now: () => now, store });
    for (let i = 0; i < OWNER_TOOL_POST_LIMIT; i += 1) {
      expect(ledger.reserve(send(T + i))).not.toBeNull();
    }
    expect(ledger.reserve(send(T + 1_000))).toBeNull();
    expect(
      ledger.match({ author: '~owner', target: 'chat/~h/c', sent: T })
    ).not.toBeNull();
    expect(ledger.reserve(send(T, { accountId: 'other' }))).not.toBeNull();
    // Expired entries free their slots.
    now += OWNER_TOOL_POST_TTL_MS + 1;
    expect(ledger.reserve(send(now))).not.toBeNull();
  });

  it('frees the slot of a released reservation but still matches it', () => {
    const { ledger } = makeLedger();
    const reservations = Array.from({ length: OWNER_TOOL_POST_LIMIT }, (_, i) =>
      ledger.reserve(send(T + i))
    );
    expect(ledger.reserve(send(T + 1_000))).toBeNull();
    reservations[0]!.release();
    expect(ledger.reserve(send(T + 1_000))).not.toBeNull();
    expect(
      ledger.match({ author: '~owner', target: 'chat/~h/c', sent: T })
    ).not.toBeNull();
  });

  it('normalizes ships on both sides of the author compare', () => {
    const { ledger } = makeLedger();
    ledger.reserve(send(T, { author: 'Owner' }));
    expect(
      ledger.match({ author: '~owner', target: 'chat/~h/c', sent: T })
    ).not.toBeNull();
    const other = makeLedger().ledger;
    other.reserve(send(T));
    expect(
      other.match({ author: ' ~OWNER', target: 'chat/~h/c', sent: T })
    ).not.toBeNull();
  });

  it('matches across accounts by author only', () => {
    const { ledger } = makeLedger();
    ledger.reserve(send(T, { accountId: 'a', author: '~a' }));
    expect(
      ledger.match({ author: '~b', target: 'chat/~h/c', sent: T })
    ).toBeNull();
    ledger.reserve(send(T + 5, { accountId: 'b', author: '~a' }));
    expect(
      ledger.match({ author: '~a', target: 'chat/~h/c', sent: T + 5 })
    ).toMatchObject({ accountId: 'b' });
  });

  it('allocates strictly increasing send times at a frozen clock', () => {
    const { ledger } = makeLedger();
    expect([
      ledger.allocateSentAt(),
      ledger.allocateSentAt(),
      ledger.allocateSentAt(),
    ]).toEqual([T, T + 1, T + 2]);
  });

  it('shares entries and allocation across instances of the shared ledger', () => {
    const first = sharedOwnerToolPostLedger();
    const second = sharedOwnerToolPostLedger();
    const a = first.allocateSentAt();
    const b = second.allocateSentAt();
    expect(b).toBeGreaterThan(a);
    first.reserve(send(a));
    expect(
      second.match({ author: '~owner', target: 'chat/~h/c', sent: a })
    ).not.toBeNull();
    _testing.clear();
    expect(
      second.match({ author: '~owner', target: 'chat/~h/c', sent: a })
    ).toBeNull();
  });

  it('canonicalizes ids and targets', () => {
    expect(canonicalPostId('~zod/170.141.184')).toBe('170141184');
    expect(canonicalPostId('170.141.184')).toBe('170141184');
    expect(canonicalPostId('170141184')).toBe('170141184');
    expect(canonicalTarget('Chat/zod/c')).toBe('chat/~zod/c');
    expect(canonicalTarget('zod')).toBe('~zod');
    expect(canonicalTarget('0V1.ABC')).toBe('0v1.abc');
  });
});

describe('inbound posts from firehose events', () => {
  function ledgerWith(post: OwnerToolPost) {
    const { ledger } = makeLedger();
    ledger.reserve(post);
    return ledger;
  }

  it('reads a top-level channel post', () => {
    const response = {
      post: { id: '170.141', 'r-post': { set: { essay: { sent: T } } } },
    };
    const inbound = channelInboundPost('chat/~h/c', response, '~owner');
    expect(inbound).toEqual({
      author: '~owner',
      target: 'chat/~h/c',
      sent: T,
      postId: '170.141',
    });
    expect(ledgerWith(send(T)).match(inbound)).not.toBeNull();
    expect(ledgerWith(send(T + 10)).match(inbound)).toBeNull();
  });

  it('reads a thread reply, and a reply edit that keeps its original sent', () => {
    const reply = (sent: number) => ({
      post: {
        id: '170.1',
        'r-post': {
          reply: {
            id: '170.2',
            'r-reply': { set: { 'reply-essay': { sent } } },
          },
        },
      },
    });
    const inbound = channelInboundPost('chat/~h/c', reply(T), '~owner');
    expect(inbound).toEqual({
      author: '~owner',
      target: 'chat/~h/c',
      sent: T,
      postId: '170.2',
      parentId: '170.1',
    });
    expect(ledgerWith(send(T)).match(inbound)).not.toBeNull();
    const edited = channelInboundPost('chat/~h/c', reply(T - 99_999), '~owner');
    const editLedger = ledgerWith({
      kind: 'edit',
      accountId: 'default',
      author: '~owner',
      target: 'chat/~h/c',
      postId: '1702',
      parentId: '1701',
    });
    expect(editLedger.match(edited)).not.toBeNull();
    expect(
      editLedger.match(channelInboundPost('chat/~h/c', reply(T), '~alice'))
    ).toBeNull();
  });

  it('returns null for a channel event without post content', () => {
    expect(
      channelInboundPost('chat/~h/c', { post: { id: '1' } }, '~owner')
    ).toBeNull();
  });

  it('reads a club writ and a 1:1 DM writ', () => {
    const writ = (whom: unknown) => ({
      whom,
      id: `~owner/${formatSentAt(T)}`,
      response: { add: { essay: { sent: T } } },
    });
    const club = chatInboundPost(writ('0v1.abc'), '~owner', '~bot');
    expect(club).toEqual({
      author: '~owner',
      target: '0v1.abc',
      receivingShip: '~bot',
      sent: T,
      postId: `~owner/${formatSentAt(T)}`,
    });
    expect(
      ledgerWith(send(T, { target: '0v1.abc' })).match(club)
    ).not.toBeNull();
    const dm = chatInboundPost(writ({ ship: '~alice' }), '~owner', '~bot');
    expect(dm).toMatchObject({ target: '~alice' });
    expect(ledgerWith(send(T)).match(dm)).not.toBeNull();
    expect(ledgerWith(send(T + 10)).match(dm)).toBeNull();
  });

  it('reads a DM thread reply with and without its own id', () => {
    const replyId = `~owner/${formatSentAt(T)}`;
    const withId = chatInboundPost(
      {
        whom: '0v1.abc',
        id: '~alice/170.1',
        response: {
          reply: {
            id: replyId,
            delta: { add: { 'reply-essay': { sent: T + 50 } } },
          },
        },
      },
      '~owner',
      '~bot'
    );
    expect(withId).toMatchObject({ postId: replyId });
    // The writ id still matches when the ship's `sent` is off by more than 1.
    expect(ledgerWith(send(T)).match(withId)).not.toBeNull();
    const withoutId = chatInboundPost(
      {
        whom: '0v1.abc',
        id: '~alice/170.1',
        response: { reply: { delta: { add: { 'reply-essay': { sent: T } } } } },
      },
      '~owner',
      '~bot'
    );
    expect(withoutId).toEqual({
      author: '~owner',
      target: '0v1.abc',
      receivingShip: '~bot',
      sent: T,
    });
    expect(ledgerWith(send(T)).match(withoutId)).not.toBeNull();
    expect(ledgerWith(send(T + 10)).match(withoutId)).toBeNull();
  });
});
