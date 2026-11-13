import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, test, vi } from 'vitest';
import { useMessageSearch } from './useMessageSearch';

const mocks = vi.hoisted(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  return {
    search: vi.fn(),
    client: {
      user: 'brian',
      bootstrap: {
        revision: 0,
        rooms: [
          {
            id: 'general',
            channelId: 'chat/~sampel-palnet/general',
            title: 'General',
            groupId: null,
          },
        ],
        groups: [],
        people: [],
        bot: { contactId: '~ten', name: 'Pi' },
      },
    },
  };
});
vi.mock('@tloncorp/api/client/messageSearch', () => ({
  searchMessages: mocks.search,
}));
vi.mock('@tloncorp/api/client/durable', () => ({
  getDurableClient: () => mocks.client,
}));
let renderer: ReactTestRenderer;
let state: ReturnType<typeof useMessageSearch>;
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, gcTime: Infinity } },
});
function Harness({ query }: { query: string }) {
  state = useMessageSearch({ query });
  return null;
}
function tree(query: string) {
  return React.createElement(
    QueryClientProvider,
    { client: queryClient },
    React.createElement(Harness, { query })
  );
}
async function render(query: string) {
  await act(async () => {
    renderer = create(tree(query));
  });
}
const hit = {
  post: { id: 'one', channelId: 'chat/~sampel-palnet/general' },
  authorName: 'Galen',
  conversationTitle: 'General',
};
afterEach(async () => {
  await act(async () => renderer?.unmount());
  queryClient.clear();
  mocks.search.mockReset();
  mocks.client.bootstrap.rooms = [
    {
      id: 'general',
      channelId: 'chat/~sampel-palnet/general',
      title: 'General',
      groupId: null,
    },
  ];
  mocks.client.bootstrap.revision = 0;
});

test('message pages deduplicate hits and stale membership hides cached results immediately', async () => {
  mocks.search
    .mockResolvedValueOnce({
      hits: [hit],
      nextCursor: 'next',
    })
    .mockResolvedValueOnce({
      hits: [hit, { ...hit, post: { ...hit.post, id: 'two' } }],
      nextCursor: null,
    });
  await render('needle');
  await vi.waitFor(() => expect(state.hits).toHaveLength(1));
  await act(async () => {
    await state.fetchNextPage();
  });
  await vi.waitFor(() => expect(state.hits).toHaveLength(2));
  expect(mocks.search.mock.calls[1][0].cursor).toBe('next');
  mocks.client.bootstrap.rooms = [];
  mocks.client.bootstrap.revision++;
  await act(async () => renderer.update(tree('needle')));
  expect(state.hits).toHaveLength(0);
});

test('typing debounces requests and cancels the obsolete request', async () => {
  let signal: AbortSignal | undefined;
  mocks.search.mockImplementation(({ query, signal: received }) => {
    if (query === 'old') {
      signal = received;
      return new Promise(() => {});
    }
    return Promise.resolve({
      hits: [hit],
      nextCursor: null,
    });
  });
  await render('old');
  await vi.waitFor(() => expect(signal).toBeDefined());
  await act(async () => renderer.update(tree('new')));
  expect(mocks.search).toHaveBeenCalledTimes(1);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 300));
  });
  await vi.waitFor(() => expect(mocks.search).toHaveBeenCalledTimes(2));
  expect(signal!.aborted).toBe(true);
  expect(mocks.search.mock.calls[1][0].query).toBe('new');
});
