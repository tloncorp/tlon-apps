import { afterEach, expect, test } from 'bun:test';
import { validateBrowserViewerUrl } from './browser-viewer';
const previous = process.env.TLON_BROWSER_VIEWER_DEV_ORIGIN;
afterEach(() => {
  if (previous === undefined) delete process.env.TLON_BROWSER_VIEWER_DEV_ORIGIN;
  else process.env.TLON_BROWSER_VIEWER_DEV_ORIGIN = previous;
});
test('delivery accepts only the configured development viewer with a signed path', () => {
  process.env.TLON_BROWSER_VIEWER_DEV_ORIGIN = 'http://192.168.1.25:43841';
  expect(
    validateBrowserViewerUrl('http://192.168.1.25:43841/s/payload.signature')
  ).toBe('http://192.168.1.25:43841/s/payload.signature');
  for (const url of [
    'http://192.168.1.25:43842/s/payload.signature',
    'http://192.168.1.26:43841/s/payload.signature',
    'http://192.168.1.25:43841/s/unsigned',
    'http://user@192.168.1.25:43841/s/payload.signature',
  ])
    expect(() => validateBrowserViewerUrl(url)).toThrow();
  delete process.env.TLON_BROWSER_VIEWER_DEV_ORIGIN;
  expect(() =>
    validateBrowserViewerUrl('http://192.168.1.25:43841/s/payload.signature')
  ).toThrow();
});
