import {
  expect,
  type Browser,
  type Page,
  type TestInfo,
} from '@playwright/test';
import { randomUUID } from 'node:crypto';
import {
  assessPendingSendEvidence,
  createFailedSendGate,
  FAILED_SEND_RETRY_TITLE,
  pendingSendTargetIsExposed,
  type PendingSendEvidence,
} from '../../../../packages/app/fixtures/scrollKeyboardTrace';
import { assessScrollReadingTrace } from '../../../../packages/app/fixtures/scrollReadingTrace';
import * as helpers from '../helpers';
import { currentLocalChannel, post } from './scrollerContentScenario';
import { writeReferencePosts } from './scrollerReferenceScenario';
import { resolveReadingBlock, startScrollReadingTrace } from './scrollReading';
import { resolvePostScroller, settlePostScroller } from './scrollers';
import { dismissPersistedDevTools } from './scrollerWebAssets';

const TITLE =
  'pending Enter send cannot reclaim latest after deliberate upward scrolling' as const;

/** Passive observation of the app's existing fetch-SSE channel. No fetch wrapper
 * or proxy; unsupported CDP streaming remains explicit incomplete evidence. */
async function observeSendAcknowledgements(
  page: Page,
  getOwner: () => PendingSendEvidence | undefined
) {
  const session = await page.context().newCDPSession(page);
  const messages: { url: string; wall: number; raw: string }[] = [];
  const errors: string[] = [];
  const streams = new Map<
    string,
    {
      url: string;
      text: string;
      bytes: number;
      ready: boolean;
      queued: string[];
    }
  >();
  let supported = false,
    active = true;
  session.on('Network.requestWillBeSent', (event) => {
    const owner = getOwner();
    const capture = owner?.retry?.initiations;
    const request = event.request;
    if (
      !active ||
      !owner ||
      !capture ||
      request.method !== 'PUT' ||
      !request.url.startsWith(`${owner.preparation.origin}/~/channel/`)
    )
      return;
    // Without the body we cannot attribute this traffic. A missing owned start
    // will fail the exact two-request join; unrelated payloads are not retained.
    if (typeof request.postData !== 'string') return;
    let actions: any;
    try {
      actions = JSON.parse(request.postData);
    } catch {
      return;
    }
    const action =
      Array.isArray(actions) && actions.length === 1 ? actions[0] : null;
    const add = action?.json?.channel?.action?.post?.add;
    if (
      action?.action !== 'poke' ||
      action.app !== 'channels' ||
      action.json?.channel?.nest !== owner.channel ||
      JSON.stringify(add?.content) !==
        JSON.stringify([{ inline: [owner.text + ' '] }])
    )
      return;
    if (capture.events.length >= 3) {
      capture.errors.push('owned-request-observation-capacity-exceeded');
      return;
    }
    capture.events.push({
      requestId: event.requestId,
      loaderId: event.loaderId,
      documentURL: event.documentURL,
      url: request.url,
      method: request.method,
      body: request.postData,
      timestamp: event.timestamp,
      wallTime: event.wallTime,
      redirected: event.redirectResponse !== undefined,
    });
  });
  const consume = (id: string, data: string, buffered = false) => {
    const stream = streams.get(id);
    if (!stream || !data || !active) return;
    if (!stream.ready && !buffered) {
      stream.queued.push(data);
      return;
    }
    const decoded = Buffer.from(data, 'base64').toString('utf8');
    stream.bytes += decoded.length;
    if (stream.bytes > 2_000_000) {
      errors.push('SSE observation capacity exceeded');
      streams.delete(id);
      return;
    }
    stream.text += decoded.replace(/\r\n/g, '\n');
    let boundary: number;
    while ((boundary = stream.text.indexOf('\n\n')) >= 0) {
      const event = stream.text.slice(0, boundary);
      stream.text = stream.text.slice(boundary + 2);
      const raw = event
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).replace(/^ /, ''))
        .join('\n');
      if (raw) messages.push({ url: stream.url, wall: Date.now(), raw });
    }
  };
  session.on('Network.responseReceived', async (event) => {
    if (
      !active ||
      !event.response.url.includes('/~/channel/') ||
      !event.response.mimeType.includes('event-stream')
    )
      return;
    streams.set(event.requestId, {
      url: event.response.url,
      text: '',
      bytes: 0,
      ready: false,
      queued: [],
    });
    try {
      const response = await session.send('Network.streamResourceContent', {
        requestId: event.requestId,
      });
      supported = true;
      consume(event.requestId, response.bufferedData, true);
      const stream = streams.get(event.requestId);
      if (stream) {
        stream.ready = true;
        for (const chunk of stream.queued.splice(0))
          consume(event.requestId, chunk);
      }
    } catch (error) {
      errors.push(`Passive SSE unavailable: ${String(error)}`);
    }
  });
  session.on('Network.dataReceived', (event) =>
    consume(event.requestId, event.data ?? '')
  );
  await session.send('Network.enable');
  return {
    messages,
    errors,
    supported: () => supported,
    stop: async () => {
      active = false;
      await session.detach();
    },
  };
}

export async function runPendingSendScenario(
  page: Page,
  browser: Browser,
  testInfo: TestInfo,
  mode: 'pending' | 'failed-retry' = 'pending'
) {
  const token = randomUUID().slice(0, 8),
    text = `Pending send ${token} keeps later reading intent.`;
  const isRetry = mode === 'failed-retry';
  let proof: PendingSendEvidence | undefined;
  const ack = await observeSendAcknowledgements(page, () => proof);
  let closing = false;
  const failureOperations: Promise<boolean>[] = [];
  let failureGate: ReturnType<typeof createFailedSendGate> | undefined;
  let releaseGate!: () => void;
  const gate = new Promise<void>((resolve) => {
    releaseGate = resolve;
  });
  let releaseFailure!: () => void;
  const failure = new Promise<void>((resolve) => {
    releaseFailure = resolve;
  });
  let released = false;
  let capture: Awaited<ReturnType<Page['evaluateHandle']>> | undefined;
  let reading: Awaited<ReturnType<typeof startScrollReadingTrace>> | undefined;
  let routeInstalled = false;
  let held: PendingSendEvidence['request'] = null;
  const routePattern = '**/~/channel/**';
  const routeHandler = async (route: import('@playwright/test').Route) => {
    const request = route.request();
    if (failureGate) {
      const operation = failureGate.dispatch(
        {
          url: request.url(),
          method: request.method(),
          body: request.postData() ?? '',
        },
        {
          now: () => page.evaluate(() => performance.now()),
          waitForFailure: () => failure,
          waitForRetryRelease: () => gate,
          isCurrent: () =>
            !closing && new URL(page.url()).pathname === proof?.scope,
          abort: () => route.abort('blockedbyclient'),
          forward: () => route.continue(),
          observed: (receipt, index) => {
            if (index === 0) held = receipt;
            else if (index === 1 && proof?.retry) proof.retry.request = receipt;
          },
        }
      );
      failureOperations.push(operation);
      const owned = await operation;
      if (!owned) await route.continue();
      return;
    }
    let actions: unknown;
    try {
      actions = request.postDataJSON();
    } catch {
      await route.continue();
      return;
    }
    if (
      request.method() !== 'PUT' ||
      !JSON.stringify(actions).includes(token)
    ) {
      await route.continue();
      return;
    }
    if (held) {
      proof?.errors.push('Duplicate target send request');
      await route.continue();
      return;
    }
    const now = await page.evaluate(() => performance.now());
    held = {
      url: request.url(),
      method: request.method(),
      body: request.postData()!,
      actions,
      heldAt: now,
      releasedAt: NaN,
      continuedAt: NaN,
      overridesProvided: false,
    };
    await gate;
    held.continuedAt = await page.evaluate(() => performance.now());
    await route.continue();
  };
  try {
    await page.setViewportSize({ width: 1280, height: 800 });
    await dismissPersistedDevTools(page);
    await helpers.createGroup(page);
    await helpers.navigateToChannel(page, 'General');
    const { channelId, origin } = currentLocalChannel(page);
    const seed = Array.from(
      { length: 36 },
      (_, index) =>
        `Send reader row ${index}: An unchanged reading character remains visible here.`
    );
    await writeReferencePosts(
      page.request,
      channelId,
      seed.map((value) => [{ inline: [value] }])
    );
    // Reload binds passive CDP observation to the app's actual new fetch stream.
    await page.reload();
    const input = page.getByTestId('MessageInput');
    await expect(input).toBeVisible({ timeout: 60_000 });
    await dismissPersistedDevTools(page);
    await expect(post(page, seed.at(-1)!)).toBeVisible({ timeout: 30_000 });
    const list = await resolvePostScroller(post(page, seed.at(-1)!));
    await settlePostScroller(list);
    await input.click();
    await expect(input).toHaveValue('');
    await page.bringToFront();
    const preparation = await page.evaluate(() => ({
      ship: (window as unknown as { ship: string }).ship,
      e2eMode:
        (window as unknown as { TLON_IS_E2E?: boolean }).TLON_IS_E2E === true,
      origin: location.origin,
      scripts: Array.from(document.scripts)
        .map((script) => script.src)
        .filter(Boolean),
      developmentRuntime:
        performance
          .getEntriesByType('resource')
          .some((resource) => resource.name.includes('/@vite/client')) ||
        (
          window as unknown as {
            __vite_plugin_react_preamble_installed__?: boolean;
          }
        ).__vite_plugin_react_preamble_installed__ === true,
      scope: location.pathname,
      timeOrigin: performance.timeOrigin,
      declaredAt: performance.now(),
    }));
    proof = {
      version: 1,
      title: isRetry ? FAILED_SEND_RETRY_TITLE : TITLE,
      token,
      text,
      scope: preparation.scope,
      channel: channelId,
      declaredAt: preparation.declaredAt,
      timeOrigin: preparation.timeOrigin,
      preparation: {
        ...preparation,
        browser: browser.version(),
        headed: testInfo.project.use.headless === false,
        driver: {
          project: testInfo.project.name,
          headless: testInfo.project.use.headless,
          channel: testInfo.project.use.channel,
        },
      },
      events: [],
      samples: [],
      marks: [],
      request: null,
      backend: [],
      sse: { supported: false, errors: [], messages: [] },
      reading: null,
      readingContract: null,
      plannedEnd: null,
      errors: [],
      ...(isRetry
        ? {
            retry: {
              version: 1 as const,
              failureCode: 'blockedbyclient' as const,
              failedAt: null,
              retryAt: null,
              postId: null,
              request: null,
              failedBackend: null,
              requestCount: 0,
              initiations: {
                version: 1 as const,
                timeOrigin: preparation.timeOrigin,
                events: [],
                errors: [],
              },
            },
          }
        : {}),
    };
    if (isRetry)
      failureGate = createFailedSendGate({ origin, channel: channelId, text });
    const inputHandle = await input.elementHandle();
    if (!inputHandle) throw new Error('Actual input unavailable');
    capture = await page.evaluateHandle(
      ({ list, input, token, isRetry }) => {
        if (
          !(list instanceof HTMLElement) ||
          !(input instanceof HTMLTextAreaElement)
        )
          throw new Error('Missing real list/textarea');
        const samples: PendingSendEvidence['samples'] = [],
          events: PendingSendEvidence['events'] = [];
        let active = true,
          raf = 0;
        let ownedPostId: string | null = null;
        const measureTarget = (node: HTMLElement | undefined) => {
          if (!node) return null;
          const r = node.getBoundingClientRect();
          const rect = {
            left: r.left,
            top: r.top,
            right: r.right,
            bottom: r.bottom,
            width: r.width,
            height: r.height,
          };
          const b = list.getBoundingClientRect();
          let left = Math.max(0, b.left),
            top = Math.max(0, b.top),
            right = Math.min(innerWidth, b.right),
            bottom = Math.min(innerHeight, b.bottom);
          let visible = node.isConnected;
          for (
            let parent: HTMLElement | null = node;
            parent;
            parent = parent.parentElement
          ) {
            const style = getComputedStyle(parent);
            visible =
              visible &&
              style.display !== 'none' &&
              style.visibility === 'visible' &&
              Number(style.opacity) > 0;
            if (
              parent !== node &&
              /hidden|clip|auto|scroll/.test(style.overflowX + style.overflowY)
            ) {
              const clip = parent.getBoundingClientRect();
              if (/hidden|clip|auto|scroll/.test(style.overflowX)) {
                left = Math.max(left, clip.left);
                right = Math.min(right, clip.right);
              }
              if (/hidden|clip|auto|scroll/.test(style.overflowY)) {
                top = Math.max(top, clip.top);
                bottom = Math.min(bottom, clip.bottom);
              }
            }
          }
          const hit = [
            [0.5, 0.5],
            [0.1, 0.1],
            [0.9, 0.1],
            [0.1, 0.9],
            [0.9, 0.9],
          ].every(([x, y]) => {
            const actual = document.elementFromPoint(
              r.left + r.width * x,
              r.top + r.height * y
            );
            return (
              actual !== null && (actual === node || node.contains(actual))
            );
          });
          return {
            rect,
            clip: {
              left,
              top,
              right,
              bottom,
              width: right - left,
              height: bottom - top,
            },
            visible,
            hit,
          };
        };
        const sample = () => {
          const time = performance.now();
          samples.push({
            time,
            duration: 0,
            valid:
              list.isConnected &&
              input.isConnected &&
              document.visibilityState === 'visible',
            scope: location.pathname,
            value: input.value,
            offset: list.scrollTop,
            extent: list.scrollHeight,
            height: list.clientHeight,
            sentRows: Array.from(
              list.querySelectorAll<HTMLElement>('[data-postid]')
            )
              .filter(
                (row) =>
                  row.dataset.postid === ownedPostId ||
                  row.textContent?.includes(token)
              )
              .map((row) => ({
                id: row.dataset.postid!,
                text: row.textContent ?? '',
                deliveryCount: row.querySelectorAll(
                  '[data-testid="ChatMessageDeliveryStatus"]'
                ).length,
                ...(isRetry
                  ? {
                      contentTexts: Array.from(
                        row.querySelectorAll<HTMLElement>('*')
                      )
                        .filter(
                          (node) =>
                            node.childElementCount === 0 &&
                            node.textContent?.includes(token)
                        )
                        .map((node) => node.textContent!),
                      retryCount: Array.from(
                        row.querySelectorAll<HTMLElement>('*')
                      ).filter(
                        (node) =>
                          node.childElementCount === 0 &&
                          /^Send failed,\s*click to retry$/.test(
                            node.textContent ?? ''
                          )
                      ).length,
                      targets: {
                        message: measureTarget(
                          Array.from(
                            row.querySelectorAll<HTMLElement>('*')
                          ).filter(
                            (node) =>
                              node.childElementCount === 0 &&
                              node.textContent?.includes(token)
                          )[0]
                        ),
                        retry: measureTarget(
                          Array.from(
                            row.querySelectorAll<HTMLElement>('*')
                          ).filter(
                            (node) =>
                              node.childElementCount === 0 &&
                              /^Send failed,\s*click to retry$/.test(
                                node.textContent ?? ''
                              )
                          )[0]
                        ),
                      },
                    }
                  : {}),
              })),
          });
          samples.at(-1)!.duration = performance.now() - time;
          if (active) raf = requestAnimationFrame(sample);
        };
        const event = (e: Event) =>
          events.push({
            type: e.type,
            time: e.timeStamp,
            observedAt: performance.now(),
            trusted: e.isTrusted,
            scope: location.pathname,
            target:
              e.target === input
                ? 'input'
                : list.contains(e.target as Node)
                  ? 'list'
                  : 'other',
            value: input.value,
            ...(e instanceof KeyboardEvent ? { key: e.key } : {}),
            ...(e instanceof WheelEvent ? { deltaY: e.deltaY } : {}),
            ...(isRetry && e.type === 'click' && e.target instanceof Element
              ? {
                  postId:
                    e.target.closest<HTMLElement>('[data-postid]')?.dataset
                      .postid,
                  retryLabel: e.target.textContent ?? '',
                  ...(e instanceof MouseEvent
                    ? { clientX: e.clientX, clientY: e.clientY }
                    : {}),
                }
              : {}),
          });
        document.addEventListener('keydown', event, true);
        document.addEventListener('input', event, true);
        if (isRetry) list.addEventListener('click', event, true);
        list.addEventListener('wheel', event, { passive: true });
        sample();
        return {
          bindPost: (id: string) => {
            if (ownedPostId !== null)
              throw new Error('Provisional post already bound');
            ownedPostId = id;
          },
          snapshot: () => samples.at(-1),
          data: () => ({ samples, events }),
          stop: () => {
            active = false;
            cancelAnimationFrame(raf);
            sample();
            document.removeEventListener('keydown', event, true);
            document.removeEventListener('input', event, true);
            list.removeEventListener('wheel', event);
            if (isRetry) list.removeEventListener('click', event, true);
            return { samples, events };
          },
        };
      },
      { list, input: inputHandle, token, isRetry }
    );
    const mark = async (id: PendingSendEvidence['marks'][number]['id']) => {
      const time = await page.evaluate(() => performance.now());
      proof!.marks.push({ id, time });
      return time;
    };
    const readBackend = async (phase: 'held' | 'terminal') => {
      const url = `${origin}/~/scry/channels/v5/${channelId}/posts/newest/50/post.json`;
      const startedAt = await page.evaluate(() => performance.now());
      const response = await page.request.get(url);
      const body: unknown = await response.json();
      const completedAt = await page.evaluate(() => performance.now());
      return {
        phase,
        url,
        status: response.status(),
        startedAt,
        completedAt,
        body,
      };
    };
    await page.route(routePattern, routeHandler);
    routeInstalled = true;
    await page.keyboard.type(text, { delay: 15 });
    await expect(input).toHaveValue(text);
    await mark('enter');
    await page.keyboard.press('Enter');
    await expect.poll(() => held !== null, { timeout: 5000 }).toBe(true);
    await expect(post(page, text)).toBeVisible();
    await expect(
      post(page, text).getByTestId('ChatMessageDeliveryStatus')
    ).toBeVisible();
    await expect(input).toHaveValue('');
    if (isRetry) {
      const id = await post(page, text).getAttribute('data-postid');
      if (!id) throw new Error('Missing actual provisional post identity');
      await capture.evaluate(
        (state: any, id: string) => state.bindPost(id),
        id
      );
    }
    await mark('pending');
    proof.backend.push(await readBackend('held'));
    if (proof.retry) {
      releaseFailure();
      const failedRow = post(page, text);
      const retryButton = failedRow.getByText(
        /^Send failed,\s*click to retry$/
      );
      await expect(retryButton).toBeVisible({ timeout: 3000 });
      proof.retry.failedAt = await page.evaluate(() => performance.now());
      proof.retry.postId = await failedRow.getAttribute('data-postid');
      proof.retry.failedBackend = await readBackend('held');
      // Observe the failed state at Latest before the real Retry and newer wheel.
      await page.waitForTimeout(220);
      const snapshot = (await capture.evaluate((state: any) =>
        state.snapshot()
      )) as PendingSendEvidence['samples'][number];
      const target = snapshot.sentRows[0]?.targets;
      proof.retry.retryAt = await page.evaluate(() => performance.now());
      if (
        !snapshot.valid ||
        snapshot.scope !== proof.scope ||
        snapshot.duration > 32 ||
        proof.retry.retryAt - snapshot.time > 100 ||
        snapshot.sentRows.length !== 1 ||
        snapshot.sentRows[0].id !== proof.retry.postId ||
        !pendingSendTargetIsExposed(target?.message) ||
        !pendingSendTargetIsExposed(target?.retry)
      )
        throw new Error(
          'Actual failed text or Retry target is not exposed; no implicit scrolling is allowed'
        );
      const rect = target!.retry!.rect;
      await page.mouse.click(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2
      );
      await expect
        .poll(() => proof!.retry!.request !== null, { timeout: 3000 })
        .toBe(true);
    }
    const box = await list.boundingBox();
    if (!box) throw new Error('Missing actual scroll hit target');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -120);
    await settlePostScroller(list);
    await mark('read');
    const anchor = await list.evaluate((element, seed) => {
      const b = element.getBoundingClientRect();
      return Array.from(element.querySelectorAll<HTMLElement>('[data-postid]'))
        .map((row) => ({
          id: row.dataset.postid!,
          rect: row.getBoundingClientRect(),
          text: seed.find((value) => row.textContent?.includes(value)),
        }))
        .filter(
          (row) =>
            row.text &&
            row.rect.top >= b.top + 30 &&
            row.rect.bottom <= b.bottom - 30
        )
        .sort(
          (a, c) =>
            Math.abs(
              (a.rect.top + a.rect.bottom) / 2 - (b.top + b.bottom) / 2
            ) -
            Math.abs((c.rect.top + c.rect.bottom) / 2 - (b.top + b.bottom) / 2)
        )[0];
    }, seed);
    if (!anchor?.text)
      throw new Error('No independent fully exposed reading row');
    const row = page.locator(`[data-postid="${anchor.id}"]`);
    const block = await resolveReadingBlock(row, anchor.text);
    const handle = await row.elementHandle();
    if (!handle) throw new Error('Reading row missing');
    reading = await startScrollReadingTrace(list, handle, {
      blockSelector: block.selector,
      start: 2,
      end: 3,
    });
    const initial = reading.baseline;
    if (!initial.point) throw new Error('Actual reading character unavailable');
    await page.waitForTimeout(220);
    const release = await mark('release');
    proof.plannedEnd = release + 5000;
    proof.readingContract = {
      scope: proof.scope,
      rowId: anchor.id,
      blockSelector: block.selector,
      revision: { id: anchor.id + ':unchanged', text: anchor.text },
      point: {
        start: 2,
        end: 3,
        x: initial.point.relativeX,
        y: initial.point.relativeY,
        tolerancePx: 1,
      },
      coverage: {
        startTime: initial.time,
        endTime: proof.plannedEnd,
        maxGapMs: 100,
        maxMeasurementDurationMs: 32,
      },
      terminalTime: release + 4000,
    };
    if (!isRetry) held!.releasedAt = release;
    released = true;
    releaseGate();
    // Resolving the hold starts an async route continuation. Read durable state
    // only after that continuation, so the read cannot race its own send.
    await expect
      .poll(
        () => Number.isFinite((proof!.retry?.request ?? held)?.continuedAt),
        { timeout: 1000 }
      )
      .toBe(true);
    let terminalRead: Awaited<ReturnType<typeof readBackend>> | undefined;
    while ((await page.evaluate(() => performance.now())) < release + 3900) {
      const candidate = await readBackend('terminal');
      const commits = Object.values(
        (candidate.body as { posts?: Record<string, unknown> }).posts ?? {}
      ).filter((p) => JSON.stringify(p).includes(token));
      const state = (await capture.evaluate((state: any) =>
        state.snapshot()
      )) as PendingSendEvidence['samples'][number];
      const exactAck = ack.messages.some((m) => {
        try {
          const data = JSON.parse(m.raw);
          return (
            m.url === held!.url &&
            data.response === 'poke' &&
            data.id ===
              ((proof!.retry?.request ?? held)!.actions as { id: number }[])[0]
                .id &&
            'ok' in data
          );
        } catch {
          return false;
        }
      });
      if (
        commits.length &&
        state.sentRows.length === 1 &&
        state.sentRows[0].deliveryCount === 0 &&
        (!ack.supported() || exactAck)
      ) {
        terminalRead = candidate;
        break;
      }
      await page.waitForTimeout(100);
    }
    if (terminalRead) proof.backend.push(terminalRead);
    const terminal = await reading.markTerminal();
    proof.marks.push({ id: 'terminal', time: terminal });
    proof.readingContract.terminalTime = terminal;
    proof.readingContract.coverage.endTime = terminal + 1000;
    const remaining =
      proof.plannedEnd - (await page.evaluate(() => performance.now()));
    if (remaining > 0) await page.waitForTimeout(remaining);
  } catch (error) {
    if (proof) proof.errors.push(String(error));
    else throw error;
  } finally {
    closing = true;
    releaseFailure();
    if (!released) {
      released = true;
      releaseGate();
    }
    const finalize = async (
      label: string,
      operation: () => Promise<unknown>
    ) => {
      try {
        await operation();
      } catch (error) {
        proof?.errors.push(`${label}: ${String(error)}`);
      }
    };
    await Promise.allSettled(failureOperations);
    if (reading) await finalize('reading-freeze', () => reading!.freeze());
    if (capture && proof)
      await finalize('capture-stop', async () => {
        const data = (await capture!.evaluate((state: any) =>
          state.stop()
        )) as Pick<PendingSendEvidence, 'events' | 'samples'>;
        proof!.samples = data.samples;
        proof!.events = data.events;
      });
    if (reading && proof)
      await finalize('reading-export', async () => {
        proof!.reading = await reading!.stop();
      });
    if (proof) {
      proof.request = held;
      if (proof.retry && failureGate) {
        proof.retry.requestCount = failureGate.requests.length;
        proof.errors.push(...failureGate.errors);
      }
      proof.sse = {
        supported: ack.supported(),
        errors: ack.errors,
        messages: ack.messages.map((m) => ({
          url: m.url,
          raw: m.raw,
          receivedAt: m.wall - proof!.timeOrigin,
        })),
      };
    }
    if (routeInstalled)
      await finalize('route-remove', () =>
        page.unroute(routePattern, routeHandler)
      );
    await finalize('ack-stop', () => ack.stop());
    if (proof) {
      const attachment = isRetry ? 'failed-send-retry' : 'pending-send-read';
      await finalize('raw-attachment', () =>
        testInfo.attach(`${attachment}-raw`, {
          contentType: 'application/json',
          body: JSON.stringify(proof),
        })
      );
      const assessment = assessPendingSendEvidence(
        proof,
        assessScrollReadingTrace
      );
      await finalize('proof-attachment', () =>
        testInfo.attach(`${attachment}-proof`, {
          contentType: 'application/json',
          body: JSON.stringify({ proof, assessment }),
        })
      );
      expect(assessment.verdict, JSON.stringify(assessment)).toBe('PASS');
      expect(proof.errors, 'Collector/finalizer errors').toEqual([]);
    }
  }
}
