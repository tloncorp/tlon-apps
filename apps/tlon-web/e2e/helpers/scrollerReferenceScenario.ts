import {
  expect,
  type APIRequestContext,
  type Browser,
  type Page,
  type Route,
} from '@playwright/test';
import { randomUUID } from 'node:crypto';
import * as helpers from '../helpers';
import { currentLocalChannel, history, post } from './scrollerContentScenario';
import { resolvePostScroller, settlePostScroller } from './scrollers';

export async function writeReferencePosts(
  request: APIRequestContext,
  channel: string,
  content: unknown[][],
  editId?: string,
  evidencePage?: Page
) {
  expect(channel).toMatch(/^chat\/~zod\//);
  const url = `http://localhost:3000/~/channel/scroller-reference-${randomUUID()}`;
  const essays = content.map((content, index) => ({
    content,
    author: '~zod',
    sent: Date.now() + index,
    kind: '/chat',
    meta: null,
    blob: null,
  }));
  const actions = essays.map((essay, index) => ({
    id: index + 1,
    action: 'poke',
    ship: 'zod',
    app: 'channels',
    mark: 'channel-action-2',
    json: {
      channel: {
        nest: channel,
        action: {
          post: editId ? { edit: { id: editId, essay } } : { add: essay },
        },
      },
    },
  }));
  const transport = {
    url,
    method: 'PUT',
    actions,
    requestedAt: Date.now(),
    requestedTime: await evidencePage?.evaluate(() => performance.now()),
    completedAt: 0,
    completedTime: undefined as number | undefined,
    status: 0,
  };
  try {
    const response = await request.put(url, { data: actions });
    transport.completedAt = Date.now();
    transport.completedTime = await evidencePage?.evaluate(() =>
      performance.now()
    );
    transport.status = response.status();
    expect(response.ok()).toBe(true);
  } finally {
    const closed = await request.post(url, {
      data: [{ id: essays.length + 1, action: 'delete' }],
    });
    expect(closed.ok()).toBe(true);
  }
  return Object.assign(essays, { transport });
}

export async function readReferenceSource(
  request: APIRequestContext,
  channel: string,
  text: string,
  evidencePage?: Page
) {
  const read = {
    url: `http://localhost:3000/~/scry/channels/v5/${channel}/posts/newest/100/post.json`,
    requestedAt: Date.now(),
    requestedTime: await evidencePage?.evaluate(() => performance.now()),
    completedAt: 0,
    completedTime: undefined as number | undefined,
  };
  const response = await request.get(read.url);
  read.completedAt = Date.now();
  read.completedTime = await evidencePage?.evaluate(() => performance.now());
  expect(response.ok()).toBe(true);
  const data = await response.json();
  const matches = Object.values(data.posts ?? {}).filter((item: any) =>
    item?.essay?.content?.some((verse: any) => verse.inline?.includes(text))
  ) as Array<{ seal: { id: string }; essay: unknown }>;
  expect(matches).toHaveLength(1);
  const id = BigInt(String(matches[0].seal.id).replace(/\./g, ''));
  const newerCount = Object.values(data.posts).filter(
    (item: any) =>
      item?.seal?.id && BigInt(String(item.seal.id).replace(/\./g, '')) > id
  ).length;
  return {
    ...matches[0],
    snapshot: {
      postCount: Object.keys(data.posts).length,
      newerCount,
      postIds: Object.values(data.posts).map((item: any) =>
        String(item.seal.id)
      ),
    },
    read,
  };
}

export async function prepareUncachedReference(
  admin: Page,
  browser: Browser,
  browsing: boolean
) {
  await admin.setViewportSize({ width: 1280, height: 800 });
  await helpers.createGroup(admin);
  await helpers.navigateToChannel(admin, 'General');
  const sourceChannel = currentLocalChannel(admin).channelId;
  const first = `Reference ${randomUUID().slice(0, 8)}: the original quoted words.`;
  const second = `${first} The source was edited while its reference remained visible. This longer revision wraps across several lines and must never revert to the original quotation after becoming ready.`;
  await writeReferencePosts(admin.request, sourceChannel, [
    [{ inline: [first] }],
    ...Array.from({ length: 60 }, (_, i) => [
      { inline: [`Source history padding ${i}`] },
    ]),
  ]);
  let source: Awaited<ReturnType<typeof readReferenceSource>>;
  await expect
    .poll(
      async () => {
        try {
          source = await readReferenceSource(
            admin.request,
            sourceChannel,
            first
          );
          return source.snapshot.newerCount >= 60;
        } catch {
          return false;
        }
      },
      { timeout: 30_000 }
    )
    .toBe(true);
  // Use the established creation path without the helper's final General
  // selection: selecting that already-open channel toggles the desktop to Home.
  await helpers.openGroupSettings(admin);
  await admin.getByTestId('GroupChannels').getByText('Channels').click();
  await helpers.createChannel(admin, 'Reference reader');
  await helpers.navigateToChannel(admin, 'Reference reader');
  const destination = currentLocalChannel(admin).channelId;
  const url = admin.url();
  const readerHistory = Array.from(
    { length: 36 },
    (_, index) => `Reader setup ${index}: ${history[index % history.length]}`
  );
  await writeReferencePosts(
    admin.request,
    destination,
    readerHistory.map((text) => [{ inline: [text] }])
  );
  const context = await browser.newContext({
    storageState: await admin.context().storageState(),
    viewport: { width: 1280, height: 800 },
  });
  const request = admin.request;
  await admin.close();
  const page = await context.newPage();
  await page.goto(url);
  await expect(page.getByTestId('MessageInput')).toBeVisible({
    timeout: 60_000,
  });
  await expect(post(page, readerHistory.at(-1)!)).toBeVisible({
    timeout: 60_000,
  });
  // Normal startup can briefly expose only its seeded latest-post preview.
  // Wait for a real overflowable list rather than treating that preview as the
  // required loaded-history preparation.
  let scroller: Awaited<ReturnType<typeof resolvePostScroller>> | undefined;
  await expect
    .poll(
      async () => {
        try {
          scroller = await resolvePostScroller(
            post(page, readerHistory.at(-1)!)
          );
          return true;
        } catch {
          return false;
        }
      },
      { timeout: 30_000 }
    )
    .toBe(true);
  if (!scroller)
    throw new Error('Prepared reference list did not load history');
  await settlePostScroller(scroller);
  await page.bringToFront();
  const preparation = await page.evaluate(async () => {
    const start = performance.now();
    while (performance.now() - start < 2000)
      await new Promise(requestAnimationFrame);
    return {
      scope: location.pathname,
      origin: location.origin,
      ship: (window as any).ship,
      e2eMode: (window as any).TLON_IS_E2E === true,
      warmupMs: performance.now() - start,
    };
  });
  expect(preparation.ship).toBe('zod');
  expect(preparation.e2eMode).toBe(false);
  const id = String(source!.seal.id)
    .replace(/\./g, '')
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const path = `/v5/said/~zod/${sourceChannel}/post/${id}`;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const requests: {
    path: string;
    requestedAt: number;
    requestedTime: number;
    releasedAt?: number;
    forwardedAt?: number;
    method: string;
    url: string;
    actions: unknown[];
    releasedTime?: number;
    forwardedTime?: number;
    forwardedActions?: unknown[];
    overrideProvided?: boolean;
  }[] = [];
  const continuations: Promise<void>[] = [];
  const handler = async (route: Route) => {
    let actions: any;
    try {
      actions = route.request().postDataJSON();
    } catch {
      return route.continue();
    }
    if (
      route.request().method() !== 'PUT' ||
      !Array.isArray(actions) ||
      !actions.some(
        (action) =>
          action.action === 'subscribe' &&
          action.app === 'channels' &&
          action.path === path
      )
    )
      return route.continue();
    const entry: (typeof requests)[number] = {
      path,
      method: route.request().method(),
      url: route.request().url(),
      actions,
      requestedAt: Date.now(),
      requestedTime: await page.evaluate(() => performance.now()),
    };
    requests.push(entry);
    const work = (async () => {
      await gate;
      entry.releasedAt = Date.now();
      entry.releasedTime = await page.evaluate(() => performance.now());
      await route.continue();
      entry.forwardedAt = Date.now();
      entry.forwardedTime = await page.evaluate(() => performance.now());
      entry.forwardedActions = actions;
      entry.overrideProvided = false;
    })();
    continuations.push(work);
    return work;
  };
  await page.route('**/~/channel/*', handler);
  const paragraph = `Reference reader ${randomUUID().slice(0, 8)} keeps this exact reading character visible.`;
  const story = [
    { block: { cite: { chan: { nest: sourceChannel, where: `/msg/${id}` } } } },
    { inline: [paragraph] },
  ];
  const newer = browsing
    ? history.slice(0, 14).map((text) => [{ inline: [`Newer ${text}`] }])
    : [];
  const essays = await writeReferencePosts(request, destination, [
    story,
    ...newer,
  ]);
  const row = post(page, paragraph);
  if (browsing) {
    await expect(post(page, `Newer ${history[13]}`)).toBeVisible({
      timeout: 30_000,
    });
    const box = await scroller.boundingBox();
    if (!box) throw new Error('Reference list unavailable');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    const delta = await row
      .getByText(paragraph, { exact: true })
      .evaluate(
        (block, list) =>
          block.getBoundingClientRect().top -
          (list.getBoundingClientRect().top +
            list.clientTop +
            list.clientHeight / 2),
        scroller
      );
    await page.mouse.wheel(0, delta);
  }
  const containingBefore = await readReferenceSource(
    request,
    destination,
    paragraph,
    page
  );
  return {
    page,
    context,
    scroller,
    row,
    paragraph,
    first,
    second,
    sourceChannel,
    destination,
    containingBefore,
    source: source!,
    id,
    story: essays[0],
    preparation,
    requests,
    path,
    request,
    release,
    cleanup: async () => {
      release();
      await Promise.allSettled(continuations);
      await page.unroute('**/~/channel/*', handler);
      await context.close();
    },
  };
}
