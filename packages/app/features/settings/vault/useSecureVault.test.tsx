import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupReactTestEnvironment } from '../../../test/sheetTestUtils';
import { useSecureVault } from './useSecureVault';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  detail: vi.fn(),
  remove: vi.fn(),
  service: vi.fn(),
  moon: vi.fn(),
  error: vi.fn(),
  event: vi.fn(),
}));
vi.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
  useFocusEffect: (effect: () => () => void) => useEffect(effect, [effect]),
}));
vi.mock('@tloncorp/api', () => ({
  getTlawnBrowserService: mocks.service,
  getTlawnMoon: mocks.moon,
}));
vi.mock('@tloncorp/shared', () => ({
  createDevLogger: () => ({ trackError: mocks.error, trackEvent: mocks.event }),
}));
vi.mock('../../../lib/envVars', () => ({
  KERNEL_SERVICE_ORIGIN: 'https://kernel.tlon.systems',
}));
vi.mock('../bot/helpers', () => ({
  normalizeMoonName: (moon: string) => moon,
}));
vi.mock('@tloncorp/api/client/browserOwnerSession', () => ({
  BrowserOwnerRequestError: class extends Error {
    status = 404;
  },
}));
vi.mock('@tloncorp/api/client/browserVaultManagement', () => ({
  listVaultLogins: mocks.list,
  getVaultLogin: mocks.detail,
  removeVaultLogin: mocks.remove,
}));
setupReactTestEnvironment();
const login = {
  key: 'login',
  id: 'item',
  revision: 1,
  origins: ['https://example.com'],
  fields: [],
};
let vault!: ReturnType<typeof useSecureVault>,
  tree: ReactTestRenderer,
  client: QueryClient;
function Probe() {
  const current = useSecureVault('owner');
  useEffect(() => {
    vault = current;
  });
  return null;
}
async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });
}
async function mount() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    tree = create(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>
    );
  });
  await settle();
  await settle();
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.service.mockResolvedValue({ browserService: 'kernel' });
  mocks.moon.mockResolvedValue('~bot-owner');
  mocks.list.mockResolvedValue([login]);
  mocks.detail.mockResolvedValue({
    ...login,
    fields: [
      {
        name: 'email',
        type: 'email',
        sensitive: false,
        hasValue: true,
        value: 'private@example.com',
      },
    ],
  });
  mocks.remove.mockResolvedValue(undefined);
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  client?.clear();
});
describe('vault management lifecycle', () => {
  it('lists without a browser session and fetches account values only when opened', async () => {
    await mount();
    expect(mocks.list).toHaveBeenCalledWith(
      '~bot-owner',
      expect.any(AbortSignal)
    );
    expect(mocks.detail).not.toHaveBeenCalled();
    await act(async () => vault.select(login));
    await settle();
    expect(vault.detail.data?.fields[0].value).toBe('private@example.com');
    await act(async () => vault.close());
    await settle();
    expect(vault.detail.data).toBeUndefined();
    expect(
      client
        .getQueryCache()
        .getAll()
        .some((q) =>
          (JSON.stringify(q.state.data) ?? '').includes('private@example.com')
        )
    ).toBe(false);
  });
  it('does not access the Kernel vault for a Steel bot', async () => {
    mocks.service.mockResolvedValue({ browserService: 'steel' });
    await mount();
    expect(mocks.list).not.toHaveBeenCalled();
    expect(vault.notice).toContain('Kernel');
  });
  it('reports a failed list request without presenting an empty vault', async () => {
    mocks.list.mockRejectedValue(new Error('network'));
    await mount();
    expect(vault.list.isError).toBe(true);
    expect(vault.list.data).toBeUndefined();
    expect(vault.loading).toBe(false);
    expect(mocks.error).toHaveBeenCalledWith('Secure Vault list failed');
  });
  it('keeps the login after failed deletion and serializes double submits', async () => {
    await mount();
    await act(async () => vault.select(login));
    await settle();
    let reject!: (e: Error) => void;
    mocks.remove.mockImplementation(
      () =>
        new Promise((_, no) => {
          reject = no;
        })
    );
    let pending!: Promise<void>;
    await act(async () => {
      pending = vault.remove();
      void vault.remove();
    });
    expect(mocks.remove).toHaveBeenCalledOnce();
    await act(async () => {
      reject(new Error('network'));
      await pending;
    });
    expect(vault.selected?.key).toBe('login');
    expect(vault.list.data).toHaveLength(1);
    expect(vault.removeError).toBeTruthy();
    mocks.remove.mockResolvedValue(undefined);
    await act(async () => vault.remove());
    await settle();
    expect(vault.selected).toBeNull();
    expect(vault.list.data).toHaveLength(0);
    expect(JSON.stringify(mocks.event.mock.calls)).not.toContain(
      'private@example.com'
    );
  });
});
