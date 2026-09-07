import type { Page, Response } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assetHash,
  verifyCurrentWebBuild,
} from '../../../../scripts/scroll-stability-web-assets.cjs';

/** Close persisted tools through the real app hook, never toggle hidden tools. */
export async function dismissPersistedDevTools(page: Page) {
  await page.evaluate(() => {
    const ship = (window as typeof window & { ship?: string }).ship;
    if (!ship) throw new Error('Missing authenticated application ship');
    const key = `~${ship}/landscape/local`;
    const persisted = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (typeof persisted?.state?.showDevTools !== 'boolean')
      throw new Error('Missing persisted developer-tools visibility');
    if (persisted.state.showDevTools) {
      if (typeof window.toggleDevTools !== 'function')
        throw new Error('Missing application developer-tools toggle');
      window.toggleDevTools();
    }
    if (
      JSON.parse(localStorage.getItem(key) ?? 'null')?.state?.showDevTools !==
      false
    )
      throw new Error('Application developer tools did not close');
  });
  await page
    .locator('.tsqd-parent-container')
    .waitFor({ state: 'hidden', timeout: 10_000 });
}

/** Observe browser-delivered bytes; never replace them with a later refetch. */
export async function startWebAssetCapture(page: Page) {
  const receiptPath = process.env.SCROLLER_WEB_BUILD_RECEIPT;
  if (process.env.USE_PRODUCTION_BUILD !== 'true') {
    if (receiptPath)
      throw new Error(
        'A production receipt requires USE_PRODUCTION_BUILD=true'
      );
    return {
      assets: 'Vite development assets',
      finish: async (): Promise<unknown> => undefined,
      dispose: () => {},
    };
  }
  if (!receiptPath)
    throw new Error('Production evidence requires SCROLLER_WEB_BUILD_RECEIPT');
  const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
  const root = resolve(__dirname, '../../../..');
  const currentCheck = verifyCurrentWebBuild(receipt, root);
  const startedAt = Date.now();
  const responses: Array<{
    url: string;
    type: string;
    status: number;
    sha256: string;
    bytes: number;
    observedAt: number;
    fromServiceWorker: boolean;
  }> = [];
  const errors: string[] = [],
    pending: Promise<void>[] = [];
  const observe = (response: Response) => {
    const request = response.request(),
      url = response.url(),
      type = request.resourceType();
    const main = type === 'document' && request.frame() === page.mainFrame();
    const pathname = new URL(url).pathname;
    const asset =
      pathname.startsWith('/apps/groups/') &&
      receipt.output.files.some(
        (file: { path: string }) =>
          file.path ===
          decodeURIComponent(pathname.slice('/apps/groups/'.length))
      );
    const executable = ['script', 'stylesheet'].includes(type);
    if (!main && !asset && !executable) return;
    const observedAt = Date.now();
    pending.push(
      (async () => {
        try {
          const body = await response.body();
          responses.push({
            url,
            type: main ? 'document' : type,
            status: response.status(),
            sha256: assetHash(body),
            bytes: body.length,
            observedAt,
            fromServiceWorker: response.fromServiceWorker(),
          });
        } catch (error) {
          errors.push(`${url}: ${String(error)}`);
        }
      })()
    );
  };
  page.on('response', observe);
  let disposed = false;
  const dispose = () => {
    if (!disposed) {
      disposed = true;
      page.off('response', observe);
    }
  };
  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page
      .getByText('Home', { exact: true })
      .waitFor({ state: 'visible', timeout: 60_000 });
    await dismissPersistedDevTools(page);
  } catch (error) {
    dispose();
    throw error;
  }
  return {
    assets: 'Built production assets',
    dispose,
    finish: async () => {
      const inventory = await page.evaluate(() => ({
        origin: location.origin,
        scope: location.pathname,
        timeOrigin: performance.timeOrigin,
        performanceEnd: performance.now(),
        completedAt: Date.now(),
        resources: performance.getEntriesByType('resource').map((entry) => ({
          url: entry.name,
          initiatorType: (entry as PerformanceResourceTiming).initiatorType,
        })),
        scripts: Array.from(document.scripts)
          .map((script) => script.src)
          .filter(Boolean),
        vitePreamble:
          (window as any).__vite_plugin_react_preamble_installed__ === true,
        serviceWorkerControlled: !!navigator.serviceWorker?.controller,
      }));
      dispose();
      await Promise.all(pending);
      return {
        version: 1,
        kind: 'served-production-assets',
        receipt,
        currentCheck,
        startedAt,
        ...inventory,
        responses,
        errors,
      };
    },
  };
}
