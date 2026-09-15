import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { ReactTestRenderer, act, create } from 'react-test-renderer';
import { beforeEach, expect, test, vi } from 'vitest';

vi.hoisted(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
});

// The theme read is the first query the app dispatches, before migrations have
// created the `settings` table. Swap the real query for a spy so we can see
// whether it reaches the database at all.
vi.mock('../db', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import('../db');
  return {
    ...actual,
    getSettings: Object.assign(
      vi.fn(async () => ({ theme: 'dark' })),
      { meta: actual.getSettings.meta }
    ),
  };
});

import * as db from '../db';
import { useThemeSettings } from './dbHooks';

const RESULT_NODE = 'Result';

function Harness({ enabled }: { enabled?: boolean }) {
  const query = useThemeSettings(
    enabled === undefined ? undefined : { enabled }
  );
  return React.createElement(RESULT_NODE, { query });
}

function resultOf(renderer: ReactTestRenderer) {
  return renderer.root.find((node) => (node.type as unknown) === RESULT_NODE)
    .props.query as ReturnType<typeof useThemeSettings>;
}

let client: QueryClient;

function tree(enabled?: boolean) {
  return React.createElement(
    QueryClientProvider,
    { client },
    React.createElement(Harness, { enabled })
  );
}

async function settle(check: () => void) {
  await act(async () => {
    await vi.waitFor(check);
  });
}

beforeEach(() => {
  vi.mocked(db.getSettings).mockClear();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
});

test('does not read settings while disabled, then reads once when enabled', async () => {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(tree(false));
  });

  expect(db.getSettings).not.toHaveBeenCalled();
  // `enabled: false` leaves react-query pending without loading, which is what
  // `useResolvedAppTheme` keys off of to hold the theme back.
  expect(resultOf(renderer).isPending).toBe(true);
  expect(resultOf(renderer).isLoading).toBe(false);
  expect(resultOf(renderer).data).toBeUndefined();

  await act(async () => {
    renderer.update(tree(true));
  });

  await settle(() => expect(db.getSettings).toHaveBeenCalledTimes(1));
  await settle(() => expect(resultOf(renderer).isPending).toBe(false));
  expect(resultOf(renderer).data).toBe('dark');
});

test('reads settings when called without options', async () => {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(tree(undefined));
  });

  await settle(() => expect(resultOf(renderer).data).toBe('dark'));
  expect(db.getSettings).toHaveBeenCalledTimes(1);
});
