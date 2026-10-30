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

function render(rendered: db.Group = group) {
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
        <Harness onResult={onResult} rendered={rendered} />
      </QueryClientProvider>
    );
  });
  const rerender = () =>
    act(() => {
      renderer.update(
        <QueryClientProvider client={client}>
          <Harness onResult={onResult} rendered={rendered} />
        </QueryClientProvider>
      );
    });
  return { latest, rerender };
}

function Harness({
  onResult,
  rendered,
}: {
  onResult: (result: ReturnType<typeof useGroupRosterPages>) => void;
  rendered: db.Group;
}) {
  onResult(useGroupRosterPages(rendered));
  return null;
}

// React Query settles over several ticks, more of them under a busy suite
async function waitFor(check: () => void) {
  for (let attempt = 0; ; attempt++) {
    try {
      check();
      return;
    } catch (error) {
      if (attempt >= 100) throw error;
    }
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
}

afterEach(() => {
  syncGroupMembersPage.mockReset();
  session.startTime = 1;
});

describe('useGroupRosterPages', () => {
  it('shows the stored roster after a failed first page, and retries it', async () => {
    syncGroupMembersPage.mockRejectedValueOnce(new Error('desk unreachable'));
    const { latest } = render();
    await waitFor(() => expect(latest.current?.awaitingFirstPage).toBe(false));

    syncGroupMembersPage.mockResolvedValueOnce({
      total: 600,
      members: [],
      next: '~nec',
    });
    act(() => latest.current?.loadMore());
    await waitFor(() => expect(latest.current?.loadedThrough).toBe('~nec'));
    expect(syncGroupMembersPage).toHaveBeenCalledTimes(2);
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
    await waitFor(() => expect(latest.current?.loadedThrough).toBe('~nec'));
    expect(syncGroupMembersPage).toHaveBeenCalledTimes(1);

    session.startTime = 2;
    rerender();
    await waitFor(() => expect(syncGroupMembersPage).toHaveBeenCalledTimes(2));
    expect(syncGroupMembersPage.mock.calls[1][0]).toMatchObject({
      after: null,
    });
    await waitFor(() => expect(latest.current?.loadedThrough).toBe('~nec'));
  });

  // e.g. a join tips a fully loaded group over the threshold
  it('leaves a whole roster from this session unpaged', async () => {
    const { latest } = render({ ...group, syncedAt: 5 });
    await waitFor(() => expect(latest.current).not.toBeNull());
    expect(latest.current?.paged).toBe(false);
    expect(latest.current?.awaitingFirstPage).toBe(false);
    // time for a page fetch to start, had paging been on
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(syncGroupMembersPage).not.toHaveBeenCalled();
  });
});
