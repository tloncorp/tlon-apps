import { expect, type Page, type Route } from '@playwright/test';
import { randomUUID, createHash } from 'node:crypto';
import {
  concurrentMedia,
  makeConcurrentPng,
} from '../../../../packages/app/fixtures/scrollConcurrentMedia';
import * as helpers from '../helpers';
import { currentLocalChannel, history, post } from './scrollerContentScenario';
import {
  readReferenceSource,
  writeReferencePosts,
} from './scrollerReferenceScenario';
import { resolvePostScroller, settlePostScroller } from './scrollers';

export async function prepareConcurrentContent(
  page: Page,
  position: 'latest' | 'history'
) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await helpers.createGroup(page);
  await helpers.navigateToChannel(page, 'General');
  const { origin, channelId } = currentLocalChannel(page);
  const paragraph = `Concurrent reader ${randomUUID().slice(0, 8)} preserves this exact reading character while both images load.`;
  const assets = concurrentMedia.map((media) => {
    const bytes = makeConcurrentPng(media.width, media.height);
    return {
      ...media,
      src: `/scroller-concurrent/${randomUUID()}/${media.id}.png`,
      bytes,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    };
  });
  const requests: Array<{
    id: string;
    url: string;
    method: string;
    requestedAt: number;
    requestedTime: number;
    releasedAt?: number;
    releasedTime?: number;
    fulfilledAt?: number;
    fulfilledTime?: number;
    status?: number;
    sha256?: string;
    bytes?: number;
  }> = [];
  const continuations: Promise<void>[] = [];
  const gates = assets.map(() => {
    let release!: () => void;
    const promise = new Promise<void>((resolve) => {
      release = resolve;
    });
    return { promise, release };
  });
  const handlers = assets.map((asset, index) => {
    const handler = async (route: Route) => {
      const request: (typeof requests)[number] = {
        id: asset.id,
        url: route.request().url(),
        method: route.request().method(),
        requestedAt: Date.now(),
        requestedTime: await page.evaluate(() => performance.now()),
      };
      requests.push(request);
      const continuation = (async () => {
        await gates[index].promise;
        request.releasedAt = Date.now();
        request.releasedTime = await page.evaluate(() => performance.now());
        await route.fulfill({
          status: 200,
          contentType: 'image/png',
          headers: { 'cache-control': 'no-store' },
          body: asset.bytes,
        });
        request.fulfilledAt = Date.now();
        request.fulfilledTime = await page.evaluate(() => performance.now());
        request.status = 200;
        request.sha256 = asset.sha256;
        request.bytes = asset.bytes.length;
      })();
      continuations.push(continuation);
      return continuation;
    };
    return handler;
  });
  for (let index = 0; index < assets.length; index++)
    await page.route(origin + assets[index].src, handlers[index]);
  try {
    await writeReferencePosts(
      page.request,
      channelId,
      Array.from({ length: 36 }, (_, index) => [
        {
          inline: [
            `Concurrent setup ${index}: ${history[index % history.length]}`,
          ],
        },
      ])
    );
    const story = [
      ...assets.map((asset) => ({
        block: {
          image: {
            src: asset.src,
            alt: `${asset.id} coordinate grid ${asset.width} by ${asset.height}`,
            width: 0,
            height: 0,
          },
        },
      })),
      { inline: [paragraph] },
    ];
    await writeReferencePosts(page.request, channelId, [
      story,
      ...(position === 'history'
        ? Array.from({ length: 18 }, (_, index) => [
            { inline: [`Concurrent newer ${index}: ${history[index]}`] },
          ])
        : []),
    ]);
    const row = post(page, paragraph);
    await expect(row).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => requests.length, { timeout: 10_000 }).toBe(2);
    for (const asset of assets)
      await expect(row.locator(`img[src="${asset.src}"]`)).toHaveCount(1);
    const scroller = await resolvePostScroller(row);
    if (position === 'history') {
      await expect(
        post(page, `Concurrent newer 17: ${history[17]}`)
      ).toBeVisible({ timeout: 30_000 });
      const box = await scroller.boundingBox();
      if (!box) throw new Error('Missing actual list');
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      const delta = await row
        .getByText(paragraph, { exact: true })
        .evaluate(
          (text, list) =>
            text.getBoundingClientRect().top -
            (list.getBoundingClientRect().top +
              list.clientTop +
              list.clientHeight / 2),
          scroller
        );
      await page.mouse.wheel(0, delta);
    }
    await settlePostScroller(scroller);
    await page.bringToFront();
    const preparation = await page.evaluate(async () => {
      const time = performance.now();
      while (performance.now() - time < 2000)
        await new Promise(requestAnimationFrame);
      return {
        scope: location.pathname,
        origin: location.origin,
        ship: (window as any).ship,
        e2eMode: (window as any).TLON_IS_E2E === true,
        warmupMs: performance.now() - time,
      };
    });
    expect(preparation.ship).toBe('zod');
    expect(preparation.e2eMode).toBe(false);
    const before = await readReferenceSource(
      page.request,
      channelId,
      paragraph,
      page
    );
    const rowId = await row.getAttribute('data-postid');
    if (!rowId) throw new Error('Missing actual post ID');
    expect(String(before.seal.id).replace(/\./g, '')).toBe(
      rowId.replace(/\./g, '')
    );
    return {
      page,
      row,
      scroller,
      rowId,
      assets,
      paragraph,
      requests,
      preparation,
      before,
      channelId,
      release: (index: number) => gates[index].release(),
      readAfter: () =>
        readReferenceSource(page.request, channelId, paragraph, page),
      cleanup,
    };
  } catch (error) {
    await cleanup();
    throw error;
  }
  async function cleanup() {
    gates.forEach((gate) => gate.release());
    await Promise.allSettled(continuations);
    for (let index = 0; index < assets.length; index++)
      await page.unroute(origin + assets[index].src, handlers[index]);
  }
}
