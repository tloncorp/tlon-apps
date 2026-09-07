import { expect, type Locator, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import * as helpers from '../helpers';
import {
  resolvePostScroller,
  settlePostScroller,
  wheelToHistory,
} from './scrollers';

// Shared actual-application setup. Defaults preserve the original image cases.
export const viewport = { width: 1280, height: 500 };
export const history = Array.from(
  { length: 18 },
  (_, index) =>
    `Scroll specimen ${String(index).padStart(2, '0')}: ${'A message with varying wrapping and a stable identity. '.repeat(1 + (index % 3)).trim()}`
);

export function post(page: Page, text: string) {
  return page.locator('[data-postid]').filter({
    has: page.getByTestId('Post').getByText(text, { exact: true }),
  });
}

export async function postId(row: Locator) {
  const id = await row.getAttribute('data-postid');
  if (!id) throw new Error('Expected stable post identity');
  return id;
}

export async function send(
  page: Page,
  text: string,
  inThread = false,
  deliveryTimeoutMs = 5000
) {
  const scope = inThread ? page.locator('#reply-container') : page;
  const input = inThread
    ? page.getByRole('textbox', { name: 'Reply', exact: true })
    : page.getByTestId('MessageInput');
  await input.fill(text);
  await scope.getByTestId('MessageInputSendButton').click();
  await expect(input).toHaveValue('');
  const sentPost = post(page, text);
  await expect(sentPost).toBeVisible();
  await expect(sentPost.getByTestId('ChatMessageDeliveryStatus')).toHaveCount(
    0,
    { timeout: deliveryTimeoutMs }
  );
  await expect(sentPost.getByText(/Send failed/)).toHaveCount(0);
}

// A real two-pixel PNG with intrinsic 2:1 dimensions. The product post declares
// 0x0 and never changes; ImageBlock must learn its dimensions from actual bytes.
export const loadingImagePng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAIAAAB7QOjdAAAADUlEQVR4nGP4zwAE/wEHAAH/4iOeWQAAAABJRU5ErkJggg==',
  'base64'
);

export function currentLocalChannel(page: Page) {
  const origin = new URL(page.url()).origin;
  expect(['http://localhost:3000', 'http://localhost:3002']).toContain(origin);
  const channelId = decodeURIComponent(
    new URL(page.url()).pathname.split('/channel/')[1] ?? ''
  ).replace(/\/$/, '');
  expect(channelId).toMatch(/^chat\/~[^/]+\/[^/]+$/);
  return { origin, channelId };
}

export async function publishUnknownSizeImage(
  page: Page,
  caption: string,
  src: string,
  options?: { inlines: unknown[]; imageFirst: boolean }
) {
  const { origin, channelId } = currentLocalChannel(page);
  const ship = await page.evaluate(() => (window as any).ship as string);
  expect(ship).toBe('zod');
  const paragraph = { inline: options?.inlines ?? [caption] };
  const image = {
    block: { image: { src, alt: caption, width: 0, height: 0 } },
  };
  const essay = {
    content: options?.imageFirst ? [image, paragraph] : [paragraph, image],
    sent: Date.now(),
    author: `~${ship}`,
    kind: '/chat',
    meta: null,
    blob: null,
  };
  const airlock = `${origin}/~/channel/scroller-image-${randomUUID()}`;
  try {
    const response = await page.request.put(airlock, {
      data: [
        {
          id: 1,
          action: 'poke',
          ship,
          app: 'channels',
          mark: 'channel-action-2',
          json: {
            channel: { nest: channelId, action: { post: { add: essay } } },
          },
        },
      ],
    });
    expect(response.ok(), 'Image post transport accepted').toBe(true);
    await expect(post(page, caption)).toBeVisible({ timeout: 30_000 });
  } finally {
    const closed = await page.request.post(airlock, {
      data: [{ id: 2, action: 'delete' }],
    });
    expect(closed.ok(), 'Test-owned image airlock closed').toBe(true);
  }
  return { row: post(page, caption), essay };
}

export async function readImageEssay(page: Page, src: string) {
  const { origin, channelId } = currentLocalChannel(page);
  const response = await page.request.get(
    `${origin}/~/scry/channels/v5/${channelId}/posts/newest/40/post.json`
  );
  expect(response.ok(), 'Read committed image post').toBe(true);
  const body = await response.json();
  expect(body).toHaveProperty('posts');
  const matches = Object.values(body.posts).filter((item: any) =>
    item?.essay?.content?.some((verse: any) => verse.block?.image?.src === src)
  ) as Array<{ essay: unknown }>;
  expect(
    matches,
    'Exactly one committed post owns this image URL'
  ).toHaveLength(1);
  return matches[0].essay;
}

export async function prepareDelayedImage(
  page: Page,
  browsing: boolean,
  options?: {
    caption: string;
    inlines: unknown[];
    imageFirst: boolean;
    viewport?: { width: number; height: number };
  }
) {
  await page.setViewportSize(options?.viewport ?? viewport);
  await helpers.createGroup(page);
  await helpers.navigateToChannel(page, 'General');
  const src = `/scroller-loading/${randomUUID()}.png`;
  const url = `${new URL(page.url()).origin}${src}`;
  const caption = options?.caption ?? `Delayed image ${randomUUID()}`;
  let releaseResponse!: () => void;
  const gate = new Promise<void>((resolve) => {
    releaseResponse = resolve;
  });
  const requests: Array<{
    requestedAt: number;
    releasedAt?: number;
    fulfilledAt?: number;
  }> = [];
  const fulfillments: Promise<void>[] = [];
  const handler = (route: import('@playwright/test').Route) => {
    const request: {
      requestedAt: number;
      releasedAt?: number;
      fulfilledAt?: number;
    } = {
      requestedAt: Date.now(),
    };
    requests.push(request);
    const fulfillment = (async () => {
      await gate;
      request.releasedAt = Date.now();
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        headers: { 'cache-control': 'no-store' },
        body: loadingImagePng,
      });
      request.fulfilledAt = Date.now();
    })();
    fulfillments.push(fulfillment);
    return fulfillment;
  };
  await page.route(url, handler);
  const cleanup = async () => {
    releaseResponse();
    await Promise.allSettled(fulfillments);
    await page.unroute(url, handler);
  };
  try {
    let published: Awaited<ReturnType<typeof publishUnknownSizeImage>>;
    if (browsing) {
      published = await publishUnknownSizeImage(page, caption, src, options);
      await expect
        .poll(() => requests.length, { timeout: 10_000 })
        .toBeGreaterThan(0);
    }
    for (const text of history) await send(page, text, false, 30_000);
    if (!browsing)
      published = await publishUnknownSizeImage(page, caption, src, options);
    const row = published!.row;
    const image = row.locator(`img[src="${src}"]`);
    await expect
      .poll(() => requests.length, { timeout: 10_000 })
      .toBeGreaterThan(0);
    await expect(image).toHaveCount(1);
    await expect
      .poll(() =>
        image.evaluate((element: HTMLImageElement) => element.naturalWidth)
      )
      .toBe(0);
    const scroller = await resolvePostScroller(row);
    await settlePostScroller(scroller);
    if (browsing) {
      await wheelToHistory(page, scroller);
      const reader = post(page, history[4]);
      const delta = await reader.evaluate(
        (element, list) =>
          element.getBoundingClientRect().top -
          (list.getBoundingClientRect().top + list.clientTop) -
          40,
        scroller
      );
      const box = await scroller.boundingBox();
      if (!box) throw new Error('Missing image test viewport');
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.wheel(0, delta);
      await expect(reader).toBeInViewport();
      await settlePostScroller(scroller);
    } else {
      await expect
        .poll(() =>
          scroller.evaluate((element) =>
            Math.abs(
              element.scrollHeight - element.clientHeight - element.scrollTop
            )
          )
        )
        .toBeLessThanOrEqual(1);
    }
    const imagePostId = await postId(row);
    const readerId = await postId(post(page, history[4]));
    const beforeEssay = await readImageEssay(page, src);
    expect(beforeEssay).toEqual(published!.essay);
    const beforeImage = (await image.boundingBox())!;
    const beforeRow = (await row.boundingBox())!;
    const rowHandle = await row.elementHandle();
    if (!beforeImage || !beforeRow || !rowHandle)
      throw new Error('Missing image loading geometry');
    return {
      src,
      caption,
      requests,
      row,
      rowHandle,
      image,
      scroller,
      imagePostId,
      readerId,
      beforeEssay,
      beforeImage,
      beforeRow,
      releaseResponse,
      cleanup,
    };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
