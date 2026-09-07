import { afterEach, describe, expect, it, vi } from 'vitest';
import { dismissPersistedDevTools } from '../../../apps/tlon-web/e2e/helpers/scrollerWebAssets';

// Setup-hook controls only; actual overlay hit testing is verified by the
// corrected real-app Send actions, not these doubles.
function pageWithState(showDevTools) {
  let raw = JSON.stringify({ state: { showDevTools } });
  const toggle = vi.fn(() => {
    const value = JSON.parse(raw);
    value.state.showDevTools = !value.state.showDevTools;
    raw = JSON.stringify(value);
  });
  vi.stubGlobal('window', { ship: 'zod', toggleDevTools: toggle });
  vi.stubGlobal('localStorage', {
    getItem: (key) => {
      expect(key).toBe('~zod/landscape/local');
      return raw;
    },
  });
  const waitFor = vi.fn(async () => {});
  const page = {
    evaluate: async (fn) => fn(),
    locator: vi.fn(() => ({ waitFor })),
  };
  return {
    page,
    toggle,
    waitFor,
    setRaw: (value) => {
      raw = value;
    },
  };
}
afterEach(() => vi.unstubAllGlobals());
describe('developer-tools setup after production reload', () => {
  it('closes persisted visible tools once through the app hook and waits for overlay absence', async () => {
    const d = pageWithState(true);
    await dismissPersistedDevTools(d.page);
    await dismissPersistedDevTools(d.page);
    expect(d.toggle).toHaveBeenCalledTimes(1);
    expect(d.page.locator).toHaveBeenCalledWith('.tsqd-parent-container');
    expect(d.waitFor).toHaveBeenCalledWith({
      state: 'hidden',
      timeout: 10_000,
    });
  });
  it('never opens already-hidden tools', async () => {
    const d = pageWithState(false);
    await dismissPersistedDevTools(d.page);
    expect(d.toggle).not.toHaveBeenCalled();
  });
  it('rejects an unavailable hook when tools are visible', async () => {
    const d = pageWithState(true);
    delete window.toggleDevTools;
    await expect(dismissPersistedDevTools(d.page)).rejects.toThrow(
      'Missing application'
    );
  });
  it('rejects unknown persisted visibility', async () => {
    const d = pageWithState(undefined);
    await expect(dismissPersistedDevTools(d.page)).rejects.toThrow(
      'Missing persisted'
    );
  });
  it('rejects malformed persisted state', async () => {
    const d = pageWithState(false);
    d.setRaw('{');
    await expect(dismissPersistedDevTools(d.page)).rejects.toThrow();
  });
  it('rejects a hook that does not actually close tools', async () => {
    const d = pageWithState(true);
    window.toggleDevTools = () => {};
    await expect(dismissPersistedDevTools(d.page)).rejects.toThrow(
      'did not close'
    );
  });
  it('retains an overlay visibility wait failure', async () => {
    const d = pageWithState(false);
    d.waitFor.mockRejectedValue(new Error('overlay remains mounted'));
    await expect(dismissPersistedDevTools(d.page)).rejects.toThrow(
      'overlay remains mounted'
    );
  });
});
