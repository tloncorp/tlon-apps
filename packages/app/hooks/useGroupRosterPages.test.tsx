import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type * as db from '@tloncorp/shared/db';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useGroupRosterPages } from './useGroupRosterPages';

const session = vi.hoisted(() => ({ startTime: 1 as number | undefined }));
const syncGroupMembersPage = vi.hoisted(() => vi.fn());

vi.mock('@tloncorp/api', () => ({
  getDeskServesRosterPages: () => true,
  onDeskServesRosterPagesChange: () => () => {},
}));

vi.mock('@tloncorp/shared/store', () => ({
  isRosterPaged: () => true,
  syncGroup: vi.fn(() => Promise.resolve()),
  syncGroupMembersPage,
  useCurrentSession: () => ({ startTime: session.startTime }),
  SyncPriority: { Low: 0, Medium: 5, High: 10 },
}));

const group: db.Group = {
  id: '~zod/big',
  memberCount: 600,
  roles: [],
  currentUserIsHost: false,
  currentUserIsMember: true,
  hostUserId: '~zod',
};

function render() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const latest: { current: ReturnType<typeof useGroupRosterPages> | null } = {
    current: null,
  };
  const onResult = (result: ReturnType<typeof useGroupRosterPages>) => {
    latest.current = result;
  };
  let renderer!: ReturnType<typeof create>;
  act(() => {
    renderer = create(
      <QueryClientProvider client={client}>
        <Harness onResult={onResult} />
      </QueryClientProvider>
    );
  });
  const rerender = () =>
    act(() => {
      renderer.update(
        <QueryClientProvider client={client}>
          <Harness onResult={onResult} />
        </QueryClientProvider>
      );
    });
  return { latest, rerender };
}

function Harness({
  onResult,
}: {
  onResult: (result: ReturnType<typeof useGroupRosterPages>) => void;
}) {
  onResult(useGroupRosterPages(group));
  return null;
}

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

afterEach(() => {
  syncGroupMembersPage.mockReset();
  session.startTime = 1;
});

describe('useGroupRosterPages', () => {
  it('shows the stored roster after a failed first page, and retries it', async () => {
    syncGroupMembersPage.mockRejectedValueOnce(new Error('desk unreachable'));
    const { latest } = render();
    await settle();

    expect(latest.current?.awaitingFirstPage).toBe(false);

    syncGroupMembersPage.mockResolvedValueOnce({
      total: 600,
      members: [],
      next: '~nec',
    });
    act(() => latest.current?.loadMore());
    await settle();

    expect(syncGroupMembersPage).toHaveBeenCalledTimes(2);
    expect(latest.current?.loadedThrough).toBe('~nec');
  });

  // a new session follows a dropped connection, which may have missed seat
  // events
  it('starts the pages over in a new session', async () => {
    syncGroupMembersPage.mockResolvedValue({
      total: 600,
      members: [],
      next: '~nec',
    });
    const { latest, rerender } = render();
    await settle();
    expect(syncGroupMembersPage).toHaveBeenCalledTimes(1);

    session.startTime = 2;
    rerender();
    await settle();

    expect(syncGroupMembersPage).toHaveBeenCalledTimes(2);
    expect(syncGroupMembersPage.mock.calls[1][0]).toMatchObject({
      after: null,
    });
    expect(latest.current?.loadedThrough).toBe('~nec');
  });
});
