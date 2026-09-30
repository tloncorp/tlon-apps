import { QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { ReactTestRenderer, act, create } from 'react-test-renderer';
import { afterEach, beforeAll, expect, test, vi } from 'vitest';

import * as db from '../db';
import { queryClient } from '../db/reactQuery';
import { setupDatabaseTestSuite } from '../test/helpers';
import { useMentionCandidates } from './dbHooks';

setupDatabaseTestSuite();

beforeAll(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

type HookResult = ReturnType<typeof useMentionCandidates>;

let renderer: ReactTestRenderer | null = null;
let latest: HookResult | null = null;

function Harness({ chatId, query }: { chatId: string; query: string }) {
  latest = useMentionCandidates({ chatId, query, enabled: true });
  return null;
}

async function mount(chatId: string, query: string) {
  await act(async () => {
    renderer = create(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(Harness, { chatId, query })
      )
    );
  });
}

function current() {
  if (!latest) throw new Error('hook not rendered');
  return latest;
}

// The placeholder is also `[]`, so a write must land after the real empty
// read has settled or the test can't tell a refresh from the first fetch.
async function waitForSettledEmpty() {
  await act(async () => {
    await vi.waitFor(() => {
      const result = current();
      expect(result.isFetched).toBe(true);
      expect(result.isPlaceholderData).toBe(false);
      expect(result.fetchStatus).toBe('idle');
      expect(result.data).toEqual([]);
    });
  });
}

async function waitForCandidate(id: string) {
  await act(async () => {
    await vi.waitFor(() => {
      expect(current().data?.map((c) => c.id)).toContain(id);
    });
  });
}

afterEach(async () => {
  if (renderer) {
    const mounted = renderer;
    await act(async () => mounted.unmount());
  }
  renderer = null;
  latest = null;
  // Invalidations are deferred with setTimeout(0); let them drain before the
  // next test resets the database.
  await new Promise((resolve) => setTimeout(resolve, 0));
  queryClient.clear();
});

test('useMentionCandidates keys on the chatMembers and contacts table deps', async () => {
  await mount('~sampel-palnet', 'samp');
  await waitForSettledEmpty();

  const [query] = queryClient
    .getQueryCache()
    .findAll({ queryKey: ['mentionCandidates'] });
  const deps = query.queryKey[1];
  expect(deps).toBeInstanceOf(Set);
  expect(deps).toEqual(new Set(['chatMembers', 'contacts']));
});

test('useMentionCandidates refreshes a settled empty result after a chatMembers write', async () => {
  await mount('~sampel-palnet', 'samp');
  await waitForSettledEmpty();

  await act(async () => {
    await db.insertMembers({
      members: [
        {
          chatId: '~sampel-palnet',
          contactId: '~sampel-palnet',
          membershipType: 'channel',
        },
      ],
    });
  });

  await waitForCandidate('~sampel-palnet');
});

test('useMentionCandidates refreshes a settled empty result after a contacts write', async () => {
  await mount('~nibset-napwyn/tlon', 'zod');
  await waitForSettledEmpty();

  await act(async () => {
    await db.upsertContact({ id: '~zod', isContact: true });
  });

  await waitForCandidate('~zod');
});
