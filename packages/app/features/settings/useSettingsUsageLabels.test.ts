import { HostingError, type TlawnTokenUsage } from '@tloncorp/api';
import { convert } from '@tloncorp/shared/utils';
import { describe, expect, it, vi } from 'vitest';

import { getStorageLabel, getTokenUsageLabel } from './useSettingsUsageLabels';

vi.mock('@react-navigation/native', () => ({ useFocusEffect: () => {} }));
vi.mock('@tloncorp/shared/db', () => ({}));
vi.mock('../../ui/components/StorageQuotaIndicator', () => ({
  useStorageInfoQuery: () => ({}),
}));
vi.mock('./bot/useBotSettingsData', () => ({ useBotSettingsIds: () => ({}) }));
vi.mock('./bot/useHostingSession', () => ({
  useHostingSession: () => 'valid',
}));

function usage(overrides: Partial<TlawnTokenUsage> = {}): TlawnTokenUsage {
  const totals = {
    input: 1,
    output: 1,
    cacheRead: 1,
    cacheWrite: 1,
    totalTokens: 1_234_567,
  };
  return {
    updatedAt: 0,
    startDate: '2026-10-01',
    endDate: '2026-10-30',
    keyAttribution: 'unavailable',
    totals,
    byProvider: [{ provider: 'openrouter', ...totals }],
    cacheStatus: { status: 'fresh' },
    ...overrides,
  };
}

function hostingError(status: number) {
  return new HostingError('failed', { method: 'GET', path: '/', status });
}

describe('getTokenUsageLabel', () => {
  it('shows the month total once every session is counted', () => {
    expect(getTokenUsageLabel({ data: usage(), error: null })).toBe('1.2M');
  });

  it('shows an unfinished total, which still counts changed sessions', () => {
    const data = usage({ cacheStatus: { status: 'refreshing' } });
    expect(getTokenUsageLabel({ data, error: null })).toBe('1.2M');
  });

  it.each(['refreshing', 'stale'] as const)(
    'says it is counting rather than 0 while %s',
    (status) => {
      const data = usage({ cacheStatus: { status } });
      data.totals = { ...data.totals, totalTokens: 0 };
      expect(getTokenUsageLabel({ data, error: null })).toBe('Counting…');
    }
  );

  it('shows a counted 0', () => {
    const data = usage();
    data.totals = { ...data.totals, totalTokens: 0 };
    expect(getTokenUsageLabel({ data, error: null })).toBe('0');
  });

  it('keeps the last total when a later read fails', () => {
    expect(
      getTokenUsageLabel({ data: usage(), error: hostingError(502) })
    ).toBe('1.2M');
  });

  it.each([404, 409])('leaves the row out on %i', (status) => {
    expect(
      getTokenUsageLabel({ data: undefined, error: hostingError(status) })
    ).toBeUndefined();
  });

  it('reports other failures', () => {
    expect(
      getTokenUsageLabel({ data: undefined, error: hostingError(502) })
    ).toBe('Unavailable');
  });
});

describe('getStorageLabel', () => {
  const gb = (n: number) => convert(n, 'gb').to('b');
  const mb = (n: number) => convert(n, 'mb').to('b');

  it.each([
    [{ data: undefined, isError: false }, 'Checking…'],
    [{ data: null, isError: false }, undefined],
    [
      { data: { usedBytes: gb(3.19), totalBytes: gb(10) }, isError: false },
      '3.2 GB of 10 GB',
    ],
    [
      { data: { usedBytes: mb(40), totalBytes: gb(10) }, isError: false },
      '40 MB of 10 GB',
    ],
    [{ data: { usedBytes: 0, totalBytes: 0 }, isError: false }, 'None'],
    [{ data: undefined, isError: true }, 'Unavailable'],
  ])('%o reads %s', (query, label) => {
    expect(getStorageLabel(query)).toBe(label);
  });
});
