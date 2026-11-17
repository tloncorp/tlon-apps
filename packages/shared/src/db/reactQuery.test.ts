import { QueryObserver } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { keyFromQueryDeps } from '../store/useKeyFromQueryDeps';
import { setupDatabaseTestSuite } from '../test/helpers';
import { getSettings, insertSettings } from './queries';
import { queryClient, resetQueryCache } from './reactQuery';

setupDatabaseTestSuite();

function observeTheme() {
  const observer = new QueryObserver(queryClient, {
    queryKey: ['themeSettings', keyFromQueryDeps(getSettings)],
    queryFn: async () => (await getSettings())?.theme ?? null,
  });
  const unsubscribe = observer.subscribe(() => {});
  return { observer, unsubscribe };
}

describe('resetQueryCache', () => {
  afterEach(() => {
    queryClient.clear();
  });

  it('keeps a mounted query receiving invalidations after logout', async () => {
    await insertSettings({ theme: 'dark' });
    const { observer, unsubscribe } = observeTheme();
    await vi.waitFor(() =>
      expect(observer.getCurrentResult().data).toBe('dark')
    );

    resetQueryCache();
    expect(observer.getCurrentResult().data).toBeUndefined();

    await insertSettings({ theme: 'nord' });
    await vi.waitFor(() =>
      expect(observer.getCurrentResult().data).toBe('nord')
    );
    unsubscribe();
  });

  it('removes queries without observers', async () => {
    await queryClient.fetchQuery({
      queryKey: ['unobserved'],
      queryFn: async () => 'cached',
    });

    resetQueryCache();

    expect(
      queryClient.getQueryCache().find({ queryKey: ['unobserved'] })
    ).toBeUndefined();
  });
});
