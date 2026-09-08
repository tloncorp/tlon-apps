import {
  expect,
  type ElementHandle,
  type Locator,
  type Page,
  type Request,
} from '@playwright/test';
import { isDeepStrictEqual } from 'node:util';

export const canonicalEditId = (value: string) => value.replaceAll('.', '');

/** GET-only committed window. Caller checks full expected content, never a substring. */
export async function readCenterEditWindow(
  page: Page,
  channel: string,
  waitForHeaders?: () => Promise<unknown>
) {
  if (
    new URL(page.url()).origin !== 'http://localhost:3000' ||
    !/^chat\/~zod\/[^/]+$/.test(channel)
  )
    throw new Error('Only the isolated local zod channel is supported');
  const url = `http://localhost:3000/~/scry/channels/v5/${channel}/posts/newest/100/post.json`;
  await waitForHeaders?.();
  const startTime = await page.evaluate(() => performance.now());
  const response = await page.request.get(url, { timeout: 10_000 });
  const body = await response.json();
  const endTime = await page.evaluate(() => performance.now());
  expect(response.status()).toBe(200);
  return { url, status: response.status(), startTime, endTime, body };
}

/** Observe original network requests; never intercept or alter an edit. */
export function recordCenterEditRequests(
  page: Page,
  channelId: string,
  timeOrigin: number
) {
  const records: any[] = [],
    errors: string[] = [],
    pending: Promise<void>[] = [];
  let sealed = false;
  const headerWaiters = new Set<() => void>();
  const listener = (request: Request) => {
    if (
      request.method() !== 'PUT' ||
      !request.url().startsWith('http://localhost:3000/~/channel/')
    )
      return;
    let actions: any;
    try {
      actions = JSON.parse(request.postData() ?? 'null');
    } catch {
      return;
    }
    if (
      !Array.isArray(actions) ||
      !actions.some(
        (a) =>
          a?.json?.channel?.nest === channelId &&
          a.json.channel.action?.post?.edit
      )
    )
      return;
    const record = {
      url: request.url(),
      method: request.method(),
      body: request.postData(),
      actions,
      startTime: null as number | null,
      headersTime: null as number | null,
      endTime: null as number | null,
      status: 0,
    };
    records.push(record);
    pending.push(
      (async () => {
        try {
          const response = await request.response();
          if (!response) throw new Error('Edit response missing');
          if (sealed) return;
          // A 204 body may never emit response.finished() in this runtime.
          // Preserve actual header evidence; an unavailable end stays unknown.
          record.status = response.status();
          const timing = request.timing();
          record.startTime = timing.startTime - timeOrigin;
          record.headersTime =
            timing.responseStart >= 0
              ? record.startTime + timing.responseStart
              : null;
          record.endTime =
            timing.responseEnd >= 0
              ? record.startTime + timing.responseEnd
              : null;
        } catch (e) {
          if (!sealed) errors.push(String(e));
        } finally {
          headerWaiters.forEach((check) => check());
        }
      })()
    );
  };
  page.on('request', listener);
  return {
    records,
    errors,
    async waitForHeaders(
      index: number,
      id: string,
      content: unknown,
      timeoutMs = 10_000
    ) {
      await new Promise<void>((resolve, reject) => {
        let timer: ReturnType<typeof setTimeout>;
        const finish = (error?: Error) => {
          clearTimeout(timer);
          headerWaiters.delete(check);
          if (error) reject(error);
          else resolve();
        };
        const check = () => {
          const record = records[index];
          if (!record?.status) {
            if (sealed)
              finish(
                new Error(
                  'Matching edit headers unavailable after finalization'
                )
              );
            return;
          }
          const edit = record.actions?.[0]?.json?.channel?.action?.post?.edit;
          if (
            record.status < 200 ||
            record.status >= 300 ||
            !Number.isFinite(record.headersTime) ||
            record.actions.length !== 1 ||
            typeof edit?.id !== 'string' ||
            canonicalEditId(edit.id) !== canonicalEditId(id) ||
            !Array.isArray(content) ||
            !isDeepStrictEqual(edit.essay?.content, content)
          )
            finish(
              new Error(
                'Response did not prove the matching edit ID and content'
              )
            );
          else finish();
        };
        timer = setTimeout(
          () =>
            finish(
              new Error('Matching edit headers unavailable within deadline')
            ),
          timeoutMs
        );
        headerWaiters.add(check);
        check();
      });
    },
    async stop(timeoutMs = 1000) {
      page.off('request', listener);
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const completed = await Promise.race([
          Promise.all(pending).then(() => true),
          new Promise<false>((resolve) => {
            timer = setTimeout(() => resolve(false), timeoutMs);
          }),
        ]);
        if (!completed)
          errors.push(
            'Edit response headers unavailable at bounded finalization'
          );
      } finally {
        clearTimeout(timer);
        sealed = true;
        headerWaiters.forEach((check) => check());
      }
    },
  };
}

/** Export immutable capture before bounded transport finalization. Even a missing
 * response cannot erase previously sampled geometry during fixture teardown. */
export async function finalizeCenterEditEvidence({
  proof,
  observer,
  reading,
  requests,
  attach,
  afterCapture,
}: {
  proof: any;
  observer: { freeze(): Promise<unknown>; stop(): Promise<unknown> };
  reading?: { freeze(): Promise<unknown>; stop(): Promise<unknown> };
  requests?: ReturnType<typeof recordCenterEditRequests>;
  attach(name: string, proof: any): Promise<unknown>;
  afterCapture?(): Promise<unknown>;
}) {
  for (const collector of [observer, reading]) {
    try {
      await collector?.freeze();
    } catch (error) {
      proof.errors.push(String(error));
    }
  }
  for (const [name, collector] of [
    ['observer', observer],
    ['reading', reading],
  ] as const) {
    try {
      proof[name] = await collector?.stop();
    } catch (error) {
      proof.errors.push(String(error));
    }
  }
  await attach('center-edit-frozen-capture', proof);
  try {
    await afterCapture?.();
  } catch (error) {
    proof.errors.push(String(error));
  }
  try {
    await requests?.stop();
  } catch (error) {
    proof.errors.push(String(error));
  }
  proof.requests = requests?.records ?? [];
  proof.errors.push(...(requests?.errors ?? []));
  await attach('center-edit-reading-proof', proof);
}

/** Supplemental row and actual action-menu observations. The reading collector
 * remains untouched. No DOM attributes, synthetic actions or fake state. */
export async function startCenterEditObserver(
  list: ElementHandle<HTMLElement>,
  editedId: string
) {
  const handle = await list.evaluateHandle((list, editedId) => {
    const frames: any[] = [],
      events: any[] = [],
      errors: string[] = [],
      wheel: any[] = [];
    const startedAt = performance.now();
    let active = true,
      raf = 0;
    const displayed = (node: HTMLElement) => {
      const r = node.getBoundingClientRect();
      if (!node.isConnected || r.width <= 0 || r.height <= 0) return false;
      let opacity = 1;
      for (let el: HTMLElement | null = node; el; el = el.parentElement) {
        const s = getComputedStyle(el);
        opacity *= Number(s.opacity);
        if (
          s.display === 'none' ||
          s.visibility !== 'visible' ||
          opacity < 0.99
        )
          return false;
      }
      return true;
    };
    const sample = () => {
      const time = performance.now(),
        b = list.getBoundingClientRect();
      const rows = [
        ...list.querySelectorAll<HTMLElement>(
          `[data-postid="${CSS.escape(editedId)}"]`
        ),
      ];
      const row = rows[0],
        r = row?.getBoundingClientRect();
      const bodies = row
        ? [...row.querySelectorAll<HTMLElement>('.is_ContentFrame')]
        : [];
      const menus = [
        ...document.querySelectorAll<HTMLElement>(
          '[data-testid="ChatMessageActions"]'
        ),
      ].filter(displayed);
      frames.push({
        time,
        duration: performance.now() - time,
        scope: location.pathname,
        offset: list.scrollTop,
        extent: list.scrollHeight,
        height: list.clientHeight,
        edited: {
          id: editedId,
          count: rows.length,
          top: r ? r.top - b.top - list.clientTop : NaN,
          height: r?.height ?? NaN,
          bodyCount: bodies.length,
          text: bodies.length === 1 ? bodies[0].textContent : null,
        },
        menuCount: menus.length,
        menuTexts: menus.map((m) => m.textContent),
        neighbors: [...list.querySelectorAll<HTMLElement>('[data-postid]')]
          .map((node) => {
            const rect = node.getBoundingClientRect();
            return {
              id: node.dataset.postid,
              top: rect.top - b.top - list.clientTop,
              height: rect.height,
            };
          })
          .filter(
            (row) => row.top + row.height > 0 && row.top < list.clientHeight
          ),
      });
      frames.at(-1).duration = performance.now() - time;
      if (!list.isConnected || document.visibilityState !== 'visible')
        errors.push('Original list unavailable');
    };
    const tick = () => {
      if (!active) return;
      try {
        sample();
      } catch (e) {
        errors.push(String(e));
      }
      raf = requestAnimationFrame(tick);
    };
    const listener = (event: Event) => {
      const path = event
        .composedPath()
        .filter((n): n is HTMLElement => n instanceof HTMLElement);
      let kind: string | undefined,
        rowId: string | null = null;
      const trigger = path.find(
        (n) => n.dataset.testid === 'MessageActionsTrigger'
      );
      if (trigger) {
        kind = 'trigger';
        rowId =
          trigger.closest('[data-postid]')?.getAttribute('data-postid') ?? null;
      } else if (
        path.some((n) => n.dataset.testid === 'MessageInputSendButton')
      )
        kind = 'save';
      else if (
        path.some(
          (n) =>
            n.textContent === 'Edit message' &&
            n.closest('[data-testid="ChatMessageActions"]')
        )
      )
        kind = 'edit';
      if (kind)
        events.push({
          kind,
          rowId,
          time: event.timeStamp,
          trusted: event.isTrusted,
          scope: location.pathname,
        });
    };
    const wheelListener = (event: WheelEvent) =>
      wheel.push({
        time: event.timeStamp,
        deltaY: event.deltaY,
        trusted: event.isTrusted,
        scope: location.pathname,
        sameList: event.currentTarget === list && list.isConnected,
        observedAt: performance.now(),
      });
    document.addEventListener('click', listener, true);
    list.addEventListener('wheel', wheelListener, { passive: true });
    tick();
    const freeze = () => {
      if (!active) return;
      active = false;
      cancelAnimationFrame(raf);
      sample();
      document.removeEventListener('click', listener, true);
      list.removeEventListener('wheel', wheelListener);
    };
    return {
      freeze,
      beginCapture() {
        frames.length = 0;
        events.length = 0;
        sample();
      },
      snapshot: () => ({ frames, events, errors, wheel, startedAt }),
      async wait(ms: number) {
        const end = performance.now() + ms;
        while (active && performance.now() < end)
          await new Promise(requestAnimationFrame);
      },
    };
  }, editedId);
  return {
    wait: (ms: number) => handle.evaluate((h, ms) => h.wait(ms), ms),
    beginCapture: () => handle.evaluate((h) => h.beginCapture()),
    snapshot: () => handle.evaluate((h) => h.snapshot()),
    freeze: () => handle.evaluate((h) => h.freeze()),
    async stop() {
      try {
        await handle.evaluate((h) => h.freeze());
        return await handle.evaluate((h) => h.snapshot());
      } finally {
        await handle.dispose();
      }
    },
  };
}

async function requireExposed(
  locator: Locator,
  list: ElementHandle<HTMLElement>
) {
  expect(
    await locator.evaluate((node, list) => {
      const r = node.getBoundingClientRect(),
        b = list.getBoundingClientRect();
      const x = (r.left + r.right) / 2,
        y = (r.top + r.bottom) / 2;
      return (
        r.width > 0 &&
        r.height > 0 &&
        r.top >= b.top + list.clientTop &&
        r.bottom <= b.top + list.clientTop + list.clientHeight &&
        document
          .elementsFromPoint(x, y)
          .some((el, i) => i === 0 && (el === node || node.contains(el)))
      );
    }, list),
    'Existing actual action target must already be exposed; do not scroll it into view'
  ).toBe(true);
}

export async function performCenterEdit(
  page: Page,
  row: Locator,
  list: ElementHandle<HTMLElement>,
  channel: string,
  id: string,
  originalInput: string,
  nextInput: string,
  waitForHeaders: () => Promise<unknown>
) {
  await requireExposed(row, list);
  await row.hover();
  const trigger = row.getByTestId('MessageActionsTrigger');
  await expect(trigger).toHaveCount(1);
  await requireExposed(trigger, list);
  await trigger.click();
  const menu = page.getByTestId('ChatMessageActions');
  await expect(menu).toHaveCount(1);
  await expect(menu).toBeVisible();
  await menu.getByText('Edit message', { exact: true }).click();
  const input = page.getByTestId('MessageInput');
  await expect(input).toHaveValue(originalInput);
  await expect(menu).toBeHidden();
  await input.fill(nextInput);
  await expect(input).toHaveValue(nextInput);
  const save = page.getByTestId('MessageInputSendButton');
  await expect(save).toBeEnabled();
  await save.click();
  await expect(input).toHaveValue('');
  const expected = [{ inline: [nextInput + ' '] }];
  let read: Awaited<ReturnType<typeof readCenterEditWindow>> | undefined;
  await expect
    .poll(
      async () => {
        read = await readCenterEditWindow(page, channel, waitForHeaders);
        const matches = Object.values(read.body.posts).filter(
          (p: any) => canonicalEditId(String(p.seal.id)) === canonicalEditId(id)
        ) as any[];
        return (
          matches.length === 1 &&
          isDeepStrictEqual(matches[0].essay.content, expected)
        );
      },
      { timeout: 10_000, intervals: [100, 200, 400] }
    )
    .toBe(true);
  await expect(row.locator('.is_ContentFrame')).toHaveText(nextInput + ' ', {
    useInnerText: false,
  });
  // Exact textContent assertion: toHaveText's string normalization is insufficient.
  expect(await row.locator('.is_ContentFrame').textContent()).toBe(
    nextInput + ' '
  );
  const measurement = await row.evaluate((row) => ({
    time: performance.now(),
    height: row.getBoundingClientRect().height,
  }));
  return { ...measurement, read: read! };
}
