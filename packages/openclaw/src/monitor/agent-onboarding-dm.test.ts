import { appendToPostBlob } from '@tloncorp/api';
import { describe, expect, it, vi } from 'vitest';

import {
  _testing as ownerToolPostsTesting,
  sharedOwnerToolPostLedger,
} from '../owner-tool-posts.js';
import {
  findOnboardingRequestInChannel,
  isDmNest,
} from './agent-onboarding.js';

const OWNER = '~ten';
const WORKSPACE = '~ten/workspace';

type Context = Parameters<typeof findOnboardingRequestInChannel>[0];
type Deps = Parameters<typeof findOnboardingRequestInChannel>[1];

function introEntry(groupId: string, author: string, timestamp: number) {
  return {
    author,
    timestamp,
    origin: 'create' as const,
    blob: appendToPostBlob(undefined, {
      type: 'tlon-agent-intro-request' as const,
      version: 1 as const,
      groupId,
      isFirstGroup: true,
    }),
  };
}

const dmContext = {
  api: { scry: vi.fn() },
  channelNest: '~pinser-botter-ten',
  ownerShip: OWNER,
} as unknown as Context;

const withHistory = (entries: unknown[]) =>
  ({ fetchHistory: vi.fn().mockResolvedValue(entries) }) as unknown as Deps;

describe('isDmNest', () => {
  it('recognizes a bare ship as a DM', () => {
    expect(isDmNest('~pinser-botter-ten')).toBe(true);
  });

  it('does not mistake a group channel for a DM', () => {
    expect(isDmNest('chat/~ten/workspace')).toBe(false);
    expect(isDmNest('notes/~ten/notes')).toBe(false);
  });
});

describe('findOnboardingRequestInChannel', () => {
  it("reads the workspace and its time out of the owner's intro request", async () => {
    await expect(
      findOnboardingRequestInChannel(
        dmContext,
        withHistory([introEntry(WORKSPACE, OWNER, 1)])
      )
    ).resolves.toEqual({ groupId: WORKSPACE, requestedAt: 1 });
  });

  it('prefers the newest when more than one was posted', async () => {
    await expect(
      findOnboardingRequestInChannel(
        dmContext,
        withHistory([
          introEntry('~ten/superseded', OWNER, 1),
          introEntry(WORKSPACE, OWNER, 5),
        ])
      )
    ).resolves.toEqual({ groupId: WORKSPACE, requestedAt: 5 });
  });

  it('ignores a request authored by anyone but the owner', async () => {
    // Only the owner can name their own workspace; a request from elsewhere
    // would let another party point onboarding at a group they control.
    await expect(
      findOnboardingRequestInChannel(
        dmContext,
        withHistory([introEntry(WORKSPACE, '~bot', 1)])
      )
    ).resolves.toBeUndefined();
  });

  it("skips a request a bot of this process posted in the owner's name", async () => {
    // Another account's tool DMed this bot as the owner (a DM to that
    // account's own bot is refused). This bot's DM nest is the owner, its
    // partner; the entry names this bot, the recipient.
    const bot = '~pinser-botter-ten';
    try {
      sharedOwnerToolPostLedger().reserve({
        kind: 'send',
        accountId: 'other',
        author: OWNER,
        target: bot,
        sentAt: 5,
      });
      await expect(
        findOnboardingRequestInChannel(
          { ...dmContext, channelNest: OWNER, botShip: bot },
          withHistory([
            introEntry('~ten/older', OWNER, 1),
            introEntry('~ten/forged', OWNER, 5),
          ])
        )
      ).resolves.toEqual({ groupId: '~ten/older', requestedAt: 1 });
    } finally {
      ownerToolPostsTesting.clear();
    }
  });

  it('takes only a created message as a request', async () => {
    // No fetchHistory override: the real scry parser decides each origin.
    const essay = (sent: number, groupId: string) => ({
      author: OWNER,
      sent,
      content: [],
      blob: introEntry(groupId, OWNER, sent).blob,
    });
    const scry = vi.fn(async () => ({
      posts: {
        '1': { seal: { id: '1' }, revision: '0', essay: essay(1, '~ten/a') },
        '2': { seal: { id: '2' }, revision: '2', essay: essay(2, '~ten/b') },
        // A channel post without a revision is not a creation.
        '3': { seal: { id: '3' }, essay: essay(3, '~ten/c') },
      },
    }));
    await expect(
      findOnboardingRequestInChannel(
        { ...dmContext, api: { scry }, channelNest: 'chat/~ten/general' },
        {}
      )
    ).resolves.toEqual({ groupId: '~ten/a', requestedAt: 1 });

    const dmScry = vi.fn(async () => ({
      writs: { '1': { seal: { id: `${OWNER}/1` }, essay: essay(4, '~ten/d') } },
    }));
    await expect(
      findOnboardingRequestInChannel(
        { ...dmContext, api: { scry: dmScry } },
        {}
      )
    ).resolves.toEqual({ groupId: '~ten/d', requestedAt: 4 });
  });

  it('is undefined before furnishing has posted one', async () => {
    // Not an error: the caller retries until the app finishes furnishing.
    await expect(
      findOnboardingRequestInChannel(dmContext, withHistory([]))
    ).resolves.toBeUndefined();
  });

  it('needs an owner to attribute the request to', async () => {
    const deps = withHistory([introEntry(WORKSPACE, OWNER, 1)]);

    await expect(
      findOnboardingRequestInChannel(
        { ...dmContext, ownerShip: null } as unknown as Context,
        deps
      )
    ).resolves.toBeUndefined();
    expect(deps.fetchHistory).not.toHaveBeenCalled();
  });
});
