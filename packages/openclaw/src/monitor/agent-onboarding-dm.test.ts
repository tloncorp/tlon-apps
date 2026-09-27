import { appendToPostBlob } from '@tloncorp/api';
import { describe, expect, it, vi } from 'vitest';

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
