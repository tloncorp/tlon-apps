import { afterEach, expect, it, vi } from 'vitest';
import { openBrowserViewerWindow } from './browserViewerWindow';
const auth = vi.hoisted(() => vi.fn());
vi.mock('./browserCredentialHandoff', () => ({
  trustedBrowserViewerUrl: (url: string) => url,
  authorizeBrowserViewer: auth,
}));
afterEach(() => {
  vi.unstubAllGlobals();
});
it('reserves an isolated tab during the click and navigates only after owner authorization', async () => {
  let resolve!: (value: string) => void;
  auth.mockReturnValue(
    new Promise<string>((done) => {
      resolve = done;
    })
  );
  const viewer = {
    opener: {},
    document: { write: vi.fn() },
    location: { replace: vi.fn() },
    close: vi.fn(),
    closed: false,
  };
  const open = vi.fn().mockReturnValue(viewer);
  vi.stubGlobal('window', { open });
  const pending = openBrowserViewerWindow(
    'https://browser-session.tlon.network/s/public.link'
  );
  expect(open).toHaveBeenCalledWith('about:blank', '_blank');
  expect(viewer.opener).toBeNull();
  expect(viewer.location.replace).not.toHaveBeenCalled();
  resolve('https://browser-session.tlon.network/s/owner.link');
  await pending;
  expect(viewer.location.replace).toHaveBeenCalledWith(
    'https://browser-session.tlon.network/s/owner.link'
  );
});
it('closes the reserved tab when the owner proof fails', async () => {
  auth.mockRejectedValue(new Error('Denied'));
  const viewer = {
    opener: {},
    document: { write: vi.fn() },
    location: { replace: vi.fn() },
    close: vi.fn(),
    closed: false,
  };
  vi.stubGlobal('window', { open: () => viewer });
  await expect(
    openBrowserViewerWindow(
      'https://browser-session.tlon.network/s/public.link'
    )
  ).rejects.toThrow('Denied');
  expect(viewer.close).toHaveBeenCalledOnce();
  expect(viewer.location.replace).not.toHaveBeenCalled();
});
