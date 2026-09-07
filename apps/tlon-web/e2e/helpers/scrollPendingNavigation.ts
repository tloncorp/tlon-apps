import {
  expect,
  type APIRequestContext,
  type Browser,
  type Page,
  type Route,
} from '@playwright/test';
import { randomUUID } from 'node:crypto';
import type { QueryClient } from '@tanstack/react-query';
import {
  navigationBackendThreadRows,
  type NavigationPendingProof,
} from '../../../../packages/app/fixtures/scrollNavigationTrace';
import * as helpers from '../helpers';
import { currentLocalChannel } from './scrollerContentScenario';
import {
  readReferenceSource,
  writeReferencePosts,
} from './scrollerReferenceScenario';

const canonical = (id: string) =>
  id.replaceAll('.', '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');

async function writeReplies(
  request: APIRequestContext,
  channel: string,
  parentId: string,
  texts: string[]
) {
  const url = `http://localhost:3000/~/channel/scroller-navigation-${randomUUID()}`;
  const actions = texts.map((text, index) => ({
    id: index + 1,
    action: 'poke',
    ship: 'zod',
    app: 'channels',
    mark: 'channel-action-2',
    json: {
      channel: {
        nest: channel,
        action: {
          post: {
            reply: {
              id: parentId,
              action: {
                add: {
                  content: [{ inline: [text] }],
                  author: '~zod',
                  sent: Date.now() + index,
                  blob: null,
                },
              },
            },
          },
        },
      },
    },
  }));
  try {
    expect((await request.put(url, { data: actions })).ok()).toBe(true);
  } finally {
    expect(
      (
        await request.post(url, {
          data: [{ id: texts.length + 1, action: 'delete' }],
        })
      ).ok()
    ).toBe(true);
  }
}

async function readBackend(request: APIRequestContext, url: string) {
  const requestedAt = Date.now();
  const response = await request.get(url);
  const body = await response.json();
  return {
    url,
    method: 'GET',
    requestedAt,
    completedAt: Date.now(),
    status: response.status(),
    body,
  };
}

/** Read-only production query-cache observation. It never starts or clears a query. */
export async function readNavigationQueries(
  page: Page,
  parentId: string,
  referenceReplyId?: string
) {
  return page.evaluate(
    ({ parentId: target, referenceReplyId: reply }) => {
      const client = (window as Window & { __tlonQueryClient?: QueryClient })
        .__tlonQueryClient;
      if (!client?.getQueryCache)
        throw new Error('Production query cache unavailable');
      type WitnessPost = {
        id: string;
        parentId: string;
        textContent: string;
        replyCount: number;
      };
      const parent = client.getQueryState<WitnessPost | null>(['post', target]);
      const thread = client
        .getQueryCache()
        .getAll()
        .find(
          (query) =>
            Array.isArray(query.queryKey?.[0]) &&
            query.queryKey[0][0] === 'thread' &&
            query.queryKey[0][1] === target
        );
      const reference = reply
        ? client.getQueryData<WitnessPost>(['post', reply, 'reference'])
        : null;
      return {
        time: performance.now(),
        route: location.pathname,
        parentQueryPresent: !!parent,
        threadQueryPresent: !!thread,
        parent: parent
          ? {
              status: parent.status,
              fetching: parent.fetchStatus,
              id: parent.data?.id ?? null,
              text: parent.data?.textContent ?? null,
              replyCount: parent.data?.replyCount ?? null,
            }
          : null,
        thread: thread
          ? {
              status: thread.state.status,
              fetching: thread.state.fetchStatus,
              ids: Array.isArray(thread.state.data)
                ? thread.state.data.map((post: WitnessPost) => post.id)
                : null,
            }
          : null,
        reference: reference
          ? {
              id: reference.id,
              parentId: reference.parentId,
              text: reference.textContent,
            }
          : null,
      };
    },
    { parentId, referenceReplyId }
  );
}

/** Hold only the exact original GET; continuing it never supplies replacement data. */
export async function holdNavigationThreadGet(
  page: Page,
  url: string,
  entries: NavigationPendingProof['requests']
) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requestSeen!: () => void;
  const seen = new Promise<void>((resolve) => {
    requestSeen = resolve;
  });
  let completed!: () => void;
  const done = new Promise<void>((resolve) => {
    completed = resolve;
  });
  const continuations: Promise<void>[] = [];
  const handler = async (route: Route) => {
    const request = route.request();
    if (request.url() !== url || request.method() !== 'GET')
      return route.continue();
    const entry: NavigationPendingProof['requests'][number] = {
      url: request.url(),
      method: request.method(),
      interceptedAt: Date.now(),
      interceptedTime: await page.evaluate(() => performance.now()),
    };
    entries.push(entry);
    requestSeen();
    const completion = (async () => {
      try {
        await gate;
        entry.releasedAt = Date.now();
        entry.releasedTime = await page.evaluate(() => performance.now());
        await route.continue();
        const response = await request.response();
        if (!response) throw new Error('Original GET produced no response');
        const failed = await response.finished();
        if (failed) throw failed;
        entry.responseStatus = response.status();
        entry.responseBody = await response.json();
        entry.completedAt = Date.now();
        entry.completedTime = await page.evaluate(() => performance.now());
      } catch (error) {
        entry.failure = String(error);
      } finally {
        completed();
      }
    })();
    continuations.push(completion);
    return completion;
  };
  await page.route(url, handler);
  return {
    release,
    requested: () =>
      Promise.race([
        seen,
        page.waitForTimeout(2500).then(() => {
          throw new Error('Exact thread GET was not intercepted');
        }),
      ]),
    completed: () =>
      Promise.race([
        done,
        page.waitForTimeout(5000).then(() => {
          throw new Error('Original thread GET did not complete');
        }),
      ]),
    async cleanup() {
      release();
      await Promise.race([
        Promise.allSettled(continuations),
        page.waitForTimeout(5000).catch(() => {}),
      ]);
      if (!page.isClosed())
        await page.unroute(url, handler).catch((error) => {
          if (!page.isClosed()) throw error;
        });
    },
  };
}

export async function preparePendingNavigation(
  admin: Page,
  browser: Browser,
  kind: NavigationPendingProof['kind']
) {
  const prefix = `Pending navigation ${randomUUID().slice(0, 8)}`;
  const texts = Array.from({ length: 24 }, (_, i) =>
    `${prefix} channel ${i}: ${'Original words retain the reading point. '.repeat(1 + (i % 3))}`.trim()
  );
  const replyTexts = Array.from({ length: 18 }, (_, i) =>
    `${prefix} reply ${i}: ${'Reply text is committed before opening. '.repeat(1 + (i % 3))}`.trim()
  );
  await admin.setViewportSize({ width: 1280, height: 800 });
  await helpers.createGroup(admin);
  await helpers.navigateToChannel(admin, 'General');
  const sourceChannel = currentLocalChannel(admin).channelId;
  const sourceRoute = new URL(admin.url()).pathname;
  await writeReferencePosts(
    admin.request,
    sourceChannel,
    texts.map((text) => [{ inline: [text] }])
  );
  let source!: Awaited<ReturnType<typeof readReferenceSource>>;
  await expect
    .poll(
      async () => {
        try {
          source = await readReferenceSource(
            admin.request,
            sourceChannel,
            texts[5]
          );
          return true;
        } catch {
          return false;
        }
      },
      { timeout: 30_000 }
    )
    .toBe(true);
  const parentId = canonical(String(source.seal.id));
  await writeReplies(admin.request, sourceChannel, parentId, replyTexts);
  const url = `http://localhost:3000/~/scry/channels/v5/${sourceChannel}/posts/post/${parentId}.json`;
  let backend!: Awaited<ReturnType<typeof readBackend>>;
  await expect
    .poll(
      async () => {
        backend = await readBackend(admin.request, url);
        return Object.keys(navigationBackendThreadRows(backend.body) ?? {})
          .length;
      },
      { timeout: 30_000 }
    )
    .toBe(19);
  const expectedRows = navigationBackendThreadRows(backend.body)!;
  expect(Object.values(expectedRows).sort()).toEqual(
    [texts[5], ...replyTexts].sort()
  );
  const referenceReplyId = Object.keys(expectedRows).find(
    (id) => expectedRows[id] === replyTexts[7]
  )!;
  let readerChannel = sourceChannel,
    readerRoute = sourceRoute;
  let readerTexts = texts;
  if (kind === 'missing-parent') {
    await writeReferencePosts(
      admin.request,
      sourceChannel,
      Array.from({ length: 60 }, (_, i) => [
        { inline: [`${prefix} cold source padding ${i}`] },
      ])
    );
    await helpers.openGroupSettings(admin);
    await admin.getByTestId('GroupChannels').getByText('Channels').click();
    await helpers.createChannel(admin, 'Pending thread reader');
    await helpers.navigateToChannel(admin, 'Pending thread reader');
    readerChannel = currentLocalChannel(admin).channelId;
    readerRoute = new URL(admin.url()).pathname;
    readerTexts = texts.map((text) => `${text} Reader.`);
    await writeReferencePosts(
      admin.request,
      readerChannel,
      readerTexts.map((text, index) => [
        ...(index === 5
          ? [
              {
                block: {
                  cite: {
                    chan: {
                      nest: sourceChannel,
                      where: `/msg/${parentId}/${referenceReplyId}`,
                    },
                  },
                },
              },
            ]
          : []),
        { inline: [text] },
      ])
    );
  }
  let readerBackend!: Awaited<ReturnType<typeof readBackend>>;
  const channelRows: Record<string, string> = {};
  await expect
    .poll(
      async () => {
        readerBackend = await readBackend(
          admin.request,
          `http://localhost:3000/~/scry/channels/v5/${readerChannel}/posts/newest/100/post.json`
        );
        for (const item of Object.values(
          readerBackend.body.posts ?? {}
        ) as Array<{
          seal: { id: string };
          essay?: { content?: { inline?: unknown[] }[] };
        }>) {
          const text = item.essay?.content?.find((verse) =>
            Array.isArray(verse.inline)
          )?.inline?.[0];
          if (typeof text === 'string' && readerTexts.includes(text))
            channelRows[canonical(String(item.seal.id))] = text;
        }
        return Object.keys(channelRows).length;
      },
      { timeout: 30_000 }
    )
    .toBe(24);
  const anchorId = Object.keys(channelRows).find(
    (id) => channelRows[id] === readerTexts[5]
  )!;
  const auth = await admin.context().storageState();
  const freshContext = {
    storage: 'cookies-and-localStorage-only' as const,
    createdAt: Date.now(),
  };
  const context = await browser.newContext({
    storageState: {
      cookies: auth.cookies,
      origins: auth.origins.map(({ origin, localStorage }) => ({
        origin,
        localStorage,
      })),
    },
    viewport: { width: 1280, height: 800 },
  });
  await admin.close();
  const page = await context.newPage();
  const proof: NavigationPendingProof = {
    version: 1,
    kind,
    sourceChannel,
    parentId,
    expectedRows,
    backend,
    freshContext,
    ...(kind === 'missing-parent' ? { referenceReplyId } : {}),
    before: { time: 0, parentQueryPresent: false, threadQueryPresent: false },
    local: null,
    requests: [],
  };
  const gate = await holdNavigationThreadGet(page, url, proof.requests);
  await page.goto(`http://localhost:3000${readerRoute}`);
  await expect(page.getByTestId('MessageInput')).toBeVisible({
    timeout: 60_000,
  });
  const row = page.locator(`[data-postid="${anchorId}"]`);
  await expect(row.getByText(readerTexts[5], { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    page
      .locator('[data-postid]:visible')
      .filter({ hasText: readerTexts.at(-1)! })
  ).toBeVisible({ timeout: 30_000 });
  await row.scrollIntoViewIfNeeded();
  if (kind === 'missing-parent')
    await expect(row.getByText(replyTexts[7], { exact: true })).toBeVisible({
      timeout: 30_000,
    });
  proof.before = await readNavigationQueries(
    page,
    parentId,
    proof.referenceReplyId
  );
  return {
    page,
    context,
    gate,
    proof,
    row,
    channelRows,
    readerBackend,
    anchorText: readerTexts[5],
    channelRoute: readerRoute,
    threadRoute: `${sourceRoute}/post/~zod/${parentId}`,
    textBlocks:
      kind === 'missing-parent'
        ? { [anchorId]: [replyTexts[7], readerTexts[5]] }
        : undefined,
    triggerText: kind === 'missing-parent' ? replyTexts[7] : '18 replies',
    async cleanup() {
      try {
        await gate.cleanup();
      } finally {
        await context.close();
      }
    },
  };
}
