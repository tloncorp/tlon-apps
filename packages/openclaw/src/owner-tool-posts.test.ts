import { afterEach, describe, expect, it } from 'vitest';

import { RESTART_REPLAY_WINDOW_MS } from './monitor/restart-replay.js';
import {
  OWNER_TOOL_POST_LIMIT,
  OWNER_TOOL_POST_TTL_MS,
  type OwnerToolPost,
  SHORTCODE_MATCH_WINDOW_MS,
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

  it('requires the target when the author is known', () => {
    const { ledger } = makeLedger();
    ledger.reserve(send(T));
    ledger.reserve({
      kind: 'edit',
      accountId: 'default',
      author: '~owner',
      target: 'chat/~h/c',
      postId: '170141',
    });
    ledger.reserve({
      kind: 'react',
      accountId: 'default',
      author: '~owner',
      target: 'chat/~h/c',
      postId: '170141',
      reaction: '👍',
    });
    const here = { author: '~owner', target: 'chat/~h/c' };
    const elsewhere = { author: '~owner', target: 'chat/~x/y' };
    expect(ledger.match({ ...here, sent: T })).not.toBeNull();
    expect(ledger.match({ ...elsewhere, sent: T })).toBeNull();
    // Edits and reactions carry no timestamp: only the target tells the same
    // post id in another channel apart.
    expect(ledger.match({ ...here, postId: '170.141' })).toMatchObject({
      kind: 'edit',
    });
    expect(ledger.match({ ...elsewhere, postId: '170.141' })).toBeNull();
    expect(
      ledger.match({ ...here, postId: '170.141', reaction: '👍' })
    ).toMatchObject({ kind: 'react' });
    expect(
      ledger.match({ ...elsewhere, postId: '170.141', reaction: '👍' })
    ).toBeNull();
  });

  it('matches a known-author one-to-one DM at the recipient bot, from its side', () => {
    // Account A runs `dms react ~bus <id> 👍` as owner ~zod; ~bus is account
    // B's bot. B's firehose names the DM by its partner, ~zod. (A DM to A's
    // own bot is refused by checkOwnerSelfDm, so this is the only 1:1 case.)
    const { ledger } = makeLedger();
    const writId = `~bus/${formatSentAt(T)}`;
    ledger.reserve({
      kind: 'react',
      accountId: 'a',
      author: '~zod',
      target: '~bus',
      postId: canonicalPostId(writId),
      reaction: '👍',
    });
    const atBus = {
      author: '~zod',
      target: '~zod',
      receivingShip: '~bus',
      postId: writId,
      reaction: '👍',
    };
    expect(ledger.match(atBus)).toMatchObject({ kind: 'react' });
    // The same writ id and reaction in the owner's DM with another bot.
    expect(ledger.match({ ...atBus, receivingShip: '~nec' })).toBeNull();
    // Or in a club with the same members.
    expect(ledger.match({ ...atBus, target: '0v1.abc' })).toBeNull();
  });

  it('matches reaction removals only as removals, by author, target and post id', () => {
    const { ledger } = makeLedger();
    const writId = `~owner/${formatSentAt(T)}`;
    // dms unreact 0v1.abc <writ>, and posts unreact chat/~h/c 170.141.
    ledger.reserve({
      kind: 'unreact',
      accountId: 'default',
      author: '~owner',
      target: '0v1.abc',
      postId: canonicalPostId(writId),
    });
    ledger.reserve({
      kind: 'unreact',
      accountId: 'default',
      author: '~owner',
      target: 'chat/~h/c',
      postId: '170141',
    });
    const dm = {
      author: '~owner',
      target: '0v1.abc',
      receivingShip: '~bot',
      postId: writId,
      reactionRemoved: true as const,
    };
    const channel = {
      author: '~owner',
      target: 'chat/~h/c',
      postId: '170.141',
      reactionRemoved: true as const,
    };
    expect(ledger.match(dm)).toMatchObject({ kind: 'unreact' });
    expect(ledger.match(channel)).toMatchObject({ kind: 'unreact' });
    expect(ledger.match({ ...dm, author: '~alice' })).toBeNull();
    expect(ledger.match({ ...dm, target: '0v1.abd' })).toBeNull();
    expect(ledger.match({ ...channel, target: 'chat/~h/d' })).toBeNull();
    expect(ledger.match({ ...channel, postId: '170.142' })).toBeNull();
    // A removal entry is not a reaction, and a reaction entry not a removal.
    expect(ledger.match({ ...channel, reactionRemoved: undefined })).toBeNull();
    expect(
      ledger.match({ ...channel, reactionRemoved: undefined, reaction: '👍' })
    ).toBeNull();
    const reacted = makeLedger().ledger;
    reacted.reserve({
      kind: 'react',
      accountId: 'default',
      author: '~owner',
      target: 'chat/~h/c',
      postId: '170141',
      reaction: ':grinning:',
    });
    reacted.reserve({ ...send(T), target: 'chat/~h/c' });
    expect(reacted.match(channel)).toBeNull();
    expect(reacted.match({ ...channel, sent: T })).toBeNull();
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

  it('matches no edit, reaction or removal without an author, but still a send', () => {
    const { ledger } = makeLedger();
    const base = {
      accountId: 'default',
      author: null,
      target: 'chat/~h/c',
      postId: '170141',
    };
    ledger.reserve({ ...base, kind: 'react', reaction: '👍' });
    ledger.reserve({ ...base, kind: 'unreact' });
    ledger.reserve({ ...base, kind: 'edit' });
    for (const author of ['~zod', '~bus', '~owner']) {
      const inbound = { author, target: 'chat/~h/c', postId: '170141' };
      expect(ledger.match({ ...inbound, reaction: '👍' })).toBeNull();
      expect(ledger.match({ ...inbound, reactionRemoved: true })).toBeNull();
      expect(ledger.match(inbound)).toBeNull();
    }
    ledger.reserve(send(T, { author: null }));
    expect(
      ledger.match({ author: '~zod', target: 'chat/~h/c', sent: T })
    ).toMatchObject({ kind: 'send', author: null });
  });

  it('keeps the channel name case-sensitive when comparing nests', () => {
    const { ledger } = makeLedger();
    ledger.reserve({
      kind: 'react',
      accountId: 'default',
      author: '~owner',
      target: 'chat/~zod/General',
      postId: '170141',
      reaction: '👍',
    });
    const inbound = { author: '~owner', postId: '170141', reaction: '👍' };
    expect(
      ledger.match({ ...inbound, target: 'chat/~zod/general' })
    ).toBeNull();
    expect(
      ledger.match({ ...inbound, target: 'CHAT/~ZOD/General' })
    ).not.toBeNull();
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
        // Received by ~alice, whose firehose names the DM by the owner.
        at: { target: '~owner', receivingShip: '~alice' },
      },
    ];
    for (const { target, postId, inboundId, at } of cases) {
      const { ledger } = makeLedger();
      ledger.reserve({
        kind: 'react',
        accountId: 'default',
        author: '~owner',
        target,
        postId,
        reaction: ':grinning:',
      });
      const inbound = {
        author: '~owner',
        target,
        postId: inboundId,
        ...at,
      };
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

  it('matches any reaction for a :shortcode: entry only within the shortcode window', () => {
    const { ledger, advance } = makeLedger();
    const entry = {
      kind: 'react' as const,
      accountId: 'default',
      author: '~owner',
      target: 'chat/~h/c',
      postId: '170141',
    };
    ledger.reserve({ ...entry, reaction: ':eyes:' });
    ledger.reserve({ ...entry, postId: '170142', reaction: '👍' });
    const inbound = {
      author: '~owner',
      target: 'chat/~h/c',
      postId: '170.141',
    };
    advance(SHORTCODE_MATCH_WINDOW_MS + 1);
    expect(ledger.match({ ...inbound, reaction: '👀' })).toBeNull();
    expect(ledger.match({ ...inbound, reaction: '🎉' })).toBeNull();
    // A Unicode entry still matches exactly for the whole TTL.
    advance(OWNER_TOOL_POST_TTL_MS - SHORTCODE_MATCH_WINDOW_MS - 2);
    const unicode = { ...inbound, postId: '170.142' };
    expect(ledger.match({ ...unicode, reaction: '👍' })).not.toBeNull();
    expect(ledger.match({ ...unicode, reaction: '👎' })).toBeNull();
  });

  it('keeps matching every reaction a :shortcode: entry matched in the window, for the TTL', () => {
    const { ledger, advance } = makeLedger();
    const entry = {
      kind: 'react' as const,
      accountId: 'default',
      author: '~owner',
      target: 'chat/~h/c',
      reaction: ':eyes:',
    };
    ledger.reserve({ ...entry, postId: '170141' });
    ledger.reserve({ ...entry, postId: '170142' });
    const inbound = {
      author: '~owner',
      target: 'chat/~h/c',
      postId: '170.141',
    };
    // The owner's own 👍 lands before the tool's 👀; neither is known to be
    // the tool's rendering, so both are kept.
    advance(10_000);
    expect(ledger.match({ ...inbound, reaction: '👍' })).not.toBeNull();
    advance(1_000);
    expect(ledger.match({ ...inbound, reaction: '👀' })).not.toBeNull();
    advance(OWNER_TOOL_POST_TTL_MS - 11_000 - 1);
    expect(ledger.match({ ...inbound, reaction: '👀' })).not.toBeNull();
    expect(ledger.match({ ...inbound, reaction: '👍' })).not.toBeNull();
    expect(ledger.match({ ...inbound, reaction: '🎉' })).toBeNull();
    // An entry that saw nothing in the window matches only its literal form.
    const unseen = { ...inbound, postId: '170.142' };
    expect(ledger.match({ ...unseen, reaction: '👀' })).toBeNull();
    expect(ledger.match({ ...unseen, reaction: ':eyes:' })).not.toBeNull();
  });

  it('records a :shortcode: match into every account entry it matches, not only the first', () => {
    const { ledger, advance } = makeLedger();
    const entry = {
      kind: 'react' as const,
      author: '~owner',
      target: 'chat/~h/c',
      postId: '170141',
      reaction: ':eyes:',
    };
    const inbound = {
      author: '~owner',
      target: 'chat/~h/c',
      postId: '170.141',
      reaction: '👀',
    };
    ledger.reserve({ ...entry, accountId: 'a' });
    expect(ledger.match(inbound)).not.toBeNull();
    advance(60 * 60_000);
    ledger.reserve({ ...entry, accountId: 'b' });
    // Account a's entry matches this too; b's must still record it.
    expect(ledger.match(inbound)).not.toBeNull();
    advance(OWNER_TOOL_POST_TTL_MS - 60 * 60_000 + 1);
    expect(ledger.match(inbound)).not.toBeNull();
  });

  it('matches a reply reaction and its removal only under the recorded parent', () => {
    const { ledger } = makeLedger();
    const entry = {
      accountId: 'default',
      author: '~owner',
      target: 'chat/~h/c',
      postId: '1702',
    };
    ledger.reserve({ ...entry, kind: 'react', reaction: '👍' });
    ledger.reserve({
      ...entry,
      kind: 'react',
      postId: '1703',
      parentId: '1701',
      reaction: '👍',
    });
    ledger.reserve({
      ...entry,
      kind: 'unreact',
      postId: '1704',
      parentId: '1701',
    });
    const inbound = { author: '~owner', target: 'chat/~h/c', reaction: '👍' };
    // Top-level on both sides.
    expect(ledger.match({ ...inbound, postId: '170.2' })).not.toBeNull();
    expect(
      ledger.match({ ...inbound, postId: '170.2', parentId: '170.1' })
    ).toBeNull();
    expect(
      ledger.match({ ...inbound, postId: '170.3', parentId: '170.1' })
    ).not.toBeNull();
    expect(
      ledger.match({ ...inbound, postId: '170.3', parentId: '170.9' })
    ).toBeNull();
    expect(ledger.match({ ...inbound, postId: '170.3' })).toBeNull();
    const removal = {
      author: '~owner',
      target: 'chat/~h/c',
      postId: '170.4',
      reactionRemoved: true as const,
    };
    expect(ledger.match({ ...removal, parentId: '170.1' })).not.toBeNull();
    expect(ledger.match({ ...removal, parentId: '170.9' })).toBeNull();
    expect(ledger.match(removal)).toBeNull();
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

  it('drops the oldest released entries to stay within the limit, never a slot holder', () => {
    const { ledger } = makeLedger();
    const reservations = Array.from({ length: OWNER_TOOL_POST_LIMIT }, (_, i) =>
      ledger.reserve(send(T + 10 * i))
    );
    for (const reservation of reservations.slice(0, 10)) {
      reservation!.release();
    }
    for (let i = 0; i < 3; i += 1) {
      expect(ledger.reserve(send(T + 10_000 + i))).not.toBeNull();
    }
    const matches = (sent: number) =>
      ledger.match({ author: '~owner', target: 'chat/~h/c', sent }) !== null;
    // The first ten were released: the three oldest made room, the rest still match.
    for (let i = 0; i < 3; i += 1)
      expect(matches(T + 10 * i), `${i}`).toBe(false);
    for (let i = 3; i < 10; i += 1)
      expect(matches(T + 10 * i), `${i}`).toBe(true);
    for (let i = 10; i < OWNER_TOOL_POST_LIMIT; i += 1) {
      expect(matches(T + 10 * i), `${i}`).toBe(true);
    }
    for (let i = 3; i < 10; i += 1) {
      expect(ledger.reserve(send(T + 20_000 + i))).not.toBeNull();
    }
    expect(ledger.reserve(send(T + 30_000))).toBeNull();
    for (let i = 10; i < OWNER_TOOL_POST_LIMIT; i += 1) {
      expect(matches(T + 10 * i), `${i}`).toBe(true);
    }
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
    expect(canonicalTarget('CHAT/~ZOD/General')).toBe('chat/~zod/General');
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
    // A 1:1 DM is named by its partner; the entry names the recipient.
    const dm = chatInboundPost(writ({ ship: '~owner' }), '~owner', '~bot');
    expect(dm).toMatchObject({ target: '~owner', receivingShip: '~bot' });
    expect(ledgerWith(send(T, { target: '~bot' })).match(dm)).not.toBeNull();
    expect(ledgerWith(send(T, { target: '~alice' })).match(dm)).toBeNull();
    expect(ledgerWith(send(T + 10, { target: '~bot' })).match(dm)).toBeNull();
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
    const club = { target: '0v1.abc' };
    // The writ id still matches when the ship's `sent` is off by more than 1.
    expect(ledgerWith(send(T, club)).match(withId)).not.toBeNull();
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
    expect(ledgerWith(send(T, club)).match(withoutId)).not.toBeNull();
    expect(ledgerWith(send(T + 10, club)).match(withoutId)).toBeNull();
  });
});
