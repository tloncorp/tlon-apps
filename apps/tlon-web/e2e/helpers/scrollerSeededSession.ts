import {
  expect,
  type Browser,
  type CDPSession,
  type Page,
  type TestInfo,
} from '@playwright/test';
import { randomUUID } from 'node:crypto';
import * as helpers from '../helpers';
import {
  seededSessionPlan,
  assessSeededSession,
  type SeededAction,
} from '../../../../packages/app/fixtures/scrollSeededSession';
import type { ScrollNavigationPlan } from '../../../../packages/app/fixtures/scrollNavigationTrace';
import {
  preparePendingNavigation,
  readNavigationQueries,
} from './scrollPendingNavigation';
import {
  readNavigationAnchor,
  startScrollNavigationTrace,
} from './scrollNavigation';
import { resolvePostScroller, settlePostScroller } from './scrollers';
import { resolveReadingBlock, startScrollReadingTrace } from './scrollReading';
import { startScrollInputTrace } from './scrollInput';
import { startConversationSemanticTrace } from './scrollerConversationSemantic';
import { setComputingPresence } from './scrollerComputingPresence';
import { send } from './scrollerContentScenario';
import { readCenterEditWindow } from './scrollerCenterEdit';

const now = (page: Page) => page.evaluate(() => performance.now());
const waitUntil = (page: Page, end: number) =>
  page.evaluate(async (end) => {
    if (!Number.isFinite(end) || end - performance.now() > 10000)
      throw Error('Invalid fixed observation deadline');
    while (performance.now() < end) await new Promise(requestAnimationFrame);
  }, end);
const canonical = (id: string) =>
  id.replaceAll('.', '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** Select an actual glyph nearest the current viewport center, from the already
 * committed plain-text corpus. The Range is not a mirror or a font estimate. */
export async function acquireReading(
  page: Page,
  list: Awaited<ReturnType<typeof resolvePostScroller>>,
  corpus: Record<string, string>
) {
  const point = await list.evaluate((list, corpus) => {
    const box = list.getBoundingClientRect();
    const cx = box.left + box.width / 2,
      cy = box.top + box.height / 2;
    let best:
      | { id: string; start: number; end: number; distance: number }
      | undefined;
    for (const row of list.querySelectorAll('[data-postid]')) {
      const id = row.getAttribute('data-postid')!;
      if (!Object.hasOwn(corpus, id)) continue;
      const blocks = [...row.querySelectorAll('*')].filter(
        (n) =>
          n.textContent === corpus[id] &&
          ![...n.children].some((c) => c.textContent === n.textContent)
      );
      if (blocks.length !== 1) continue;
      const block = blocks[0],
        walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
      let offset = 0;
      while (walker.nextNode()) {
        const node = walker.currentNode as Text;
        for (let start = 0; start < node.length;) {
          const char = String.fromCodePoint(node.data.codePointAt(start)!);
          const end = start + char.length;
          if (!/\s/u.test(char)) {
            const range = document.createRange();
            range.setStart(node, start);
            range.setEnd(node, end);
            const rects = [...range.getClientRects()];
            if (rects.length === 1) {
              const r = rects[0],
                x = r.left + r.width / 2,
                y = r.top + r.height / 2;
              const owner = document.elementFromPoint(x, y);
              if (
                r.width > 0 &&
                r.height > 0 &&
                r.top >= box.top &&
                r.bottom <= box.bottom &&
                r.left >= box.left &&
                r.right <= box.right &&
                owner &&
                block.contains(owner)
              ) {
                const distance = (y - cy) ** 2 + (x - cx) ** 2;
                if (!best || distance < best.distance)
                  best = {
                    id,
                    start: offset + start,
                    end: offset + end,
                    distance,
                  };
              }
            }
          }
          start = end;
        }
        offset += node.length;
      }
    }
    if (!best) throw Error('No current exposed committed center glyph');
    return best;
  }, corpus);
  const row = page.locator(`[data-postid="${point.id}"]`);
  const block = await resolveReadingBlock(row, corpus[point.id]);
  const handle = await row.elementHandle();
  if (!handle) throw Error('Reading row retired before acquisition');
  const capture = await startScrollReadingTrace(list, handle, {
    blockSelector: block.selector,
    start: point.start,
    end: point.end,
  });
  const baseline = capture.baseline;
  if (!baseline.point) throw Error('No retained center reading point');
  return {
    capture,
    contract: {
      scope: await capture.scope,
      rowId: point.id,
      blockSelector: block.selector,
      revision: { id: `${point.id}:committed`, text: corpus[point.id] },
      point: {
        start: point.start,
        end: point.end,
        x: baseline.point.relativeX,
        y: baseline.point.relativeY,
        tolerancePx: 1,
      },
      coverage: {
        startTime: baseline.time,
        endTime: NaN,
        maxGapMs: 100,
        maxMeasurementDurationMs: 32,
      },
      terminalTime: NaN,
    },
  };
}

// Read only: the same retained Page owns the CDP session and both page-clock
// brackets. No emulation command or product-derived conversion factor is used.
async function readWheelSurface(page: Page, client: CDPSession | undefined) {
  const snapshot = () =>
    page.evaluate(() => ({
      time: performance.now(),
      timeOrigin: performance.timeOrigin,
      scope: location.pathname,
      origin: location.origin,
      surface: {
        dpr: devicePixelRatio,
        width: innerWidth,
        height: innerHeight,
        visualWidth: visualViewport?.width,
        visualHeight: visualViewport?.height,
        visualScale: visualViewport?.scale,
        visualX: visualViewport?.offsetLeft,
        visualY: visualViewport?.offsetTop,
        topFrame: window === window.top,
      },
    }));
  try {
    if (!client) return { error: 'Wheel CDP owner unavailable' };
    const before = await snapshot();
    const metrics = await client.send('Page.getLayoutMetrics');
    const after = await snapshot();
    return { before, metrics, after };
  } catch (error) {
    return { error: String(error) };
  }
}

/** One scope-owned observation listener; it does not alter input or scrolling. */
async function observeActions(page: Page) {
  return page.evaluateHandle(() => {
    const timeOrigin = performance.timeOrigin,
      events: any[] = [],
      errors: string[] = [],
      waiters = new Set<() => void>();
    let stopped = false;
    const record = (event: Event) => {
      const target = event.target instanceof Element ? event.target : null;
      events.push({
        type: event.type,
        time: event.timeStamp,
        observedAt: performance.now(),
        timeOrigin,
        scope: location.pathname,
        trusted: event.isTrusted,
        testId:
          target?.closest('[data-testid]')?.getAttribute('data-testid') ?? null,
        ...(event instanceof WheelEvent
          ? {
              deltaX: event.deltaX,
              deltaY: event.deltaY,
              deltaMode: event.deltaMode,
              surface: {
                dpr: devicePixelRatio,
                width: innerWidth,
                height: innerHeight,
                visualWidth: visualViewport?.width,
                visualHeight: visualViewport?.height,
                visualScale: visualViewport?.scale,
                visualX: visualViewport?.offsetLeft,
                visualY: visualViewport?.offsetTop,
                topFrame: window === window.top,
              },
            }
          : {}),
        ...(event instanceof KeyboardEvent
          ? {
              key: event.key,
              code: event.code,
              ctrlKey: event.ctrlKey,
              metaKey: event.metaKey,
              shiftKey: event.shiftKey,
              altKey: event.altKey,
              repeat: event.repeat,
            }
          : {}),
        inConversation:
          !!target &&
          (() => {
            for (let n: Element | null = target; n; n = n.parentElement)
              if (
                ['auto', 'scroll'].includes(getComputedStyle(n).overflowY) &&
                n.querySelector('[data-postid]')
              )
                return true;
            return false;
          })(),
        value: target instanceof HTMLTextAreaElement ? target.value : null,
      });
      for (const wake of waiters) wake();
      if (events.length > 10000) {
        errors.push('Action event capacity exceeded');
        stop();
      }
    };
    const kinds = [
      'wheel',
      'input',
      'keydown',
      'keyup',
      'select',
      'click',
      'popstate',
    ];
    for (const kind of kinds) window.addEventListener(kind, record, true);
    function stop() {
      stopped = true;
      for (const wake of waiters) wake();
      for (const kind of kinds) window.removeEventListener(kind, record, true);
      return { events, errors };
    }
    // The native command may return before this non-blocking DOM listener runs.
    // Wait on this same observer, without selecting for a desirable payload.
    function waitForWheel(start: number) {
      return new Promise((resolve) => {
        const deadline = start + 250;
        const timer = setTimeout(
          check,
          Math.max(0, deadline - performance.now())
        );
        function finish(value: unknown) {
          clearTimeout(timer);
          waiters.delete(check);
          resolve(value);
        }
        function check() {
          const event = events.find(
            (e) => e.type === 'wheel' && e.observedAt >= start
          );
          if (stopped) finish({ error: 'Wheel observer stopped' });
          else if (!Number.isFinite(start))
            finish({ error: 'Invalid wheel dispatch clock' });
          else if (event && event.observedAt <= deadline)
            finish({
              time: event.time,
              observedAt: event.observedAt,
              timeOrigin: event.timeOrigin,
              scope: event.scope,
            });
          else if (performance.now() >= deadline)
            finish({ error: 'Wheel listener receipt exceeded 250ms' });
        }
        waiters.add(check);
        check();
      });
    }
    return { stop, waitForWheel };
  });
}

/** Observe the unmodified real send and its headers before a fresh durable GET.
 * Both page clocks are explicitly bound by their real timeOrigins. */
async function sendWithReceipt(
  sender: Page,
  observer: Page,
  action: SeededAction,
  channel: string,
  observerTimeOrigin: number
) {
  const senderTimeOrigin = await sender.evaluate(() => performance.timeOrigin);
  const matches: any[] = [];
  const pending: Promise<void>[] = [];
  const listener = (request: import('@playwright/test').Request) => {
    if (
      request.method() !== 'PUT' ||
      !request.url().startsWith(`${new URL(sender.url()).origin}/~/channel/`)
    )
      return;
    let actions: any;
    try {
      actions = request.postDataJSON();
    } catch {
      return;
    }
    if (!Array.isArray(actions)) return;
    const additions = actions.filter(
      (a) =>
        a?.action === 'poke' &&
        a.app === 'channels' &&
        a.json?.channel?.nest === channel &&
        a.json.channel.action?.post?.add
    );
    for (const a of additions) {
      const essay = a.json.channel.action.post.add;
      const record: any = {
        url: request.url(),
        method: request.method(),
        actions,
        channel,
        author: essay.author,
        text: essay.content?.map((v: any) => v.inline?.join('') ?? '').join(''),
        senderTimeOrigin,
        observerTimeOrigin,
        status: null,
        startTime: null,
        headersTime: null,
      };
      matches.push(record);
      pending.push(
        (async () => {
          const response = await request.response();
          if (!response) throw Error('Original send response unavailable');
          const t = request.timing();
          record.status = response.status();
          record.startTime = t.startTime - observerTimeOrigin;
          record.headersTime =
            t.responseStart >= 0 ? record.startTime + t.responseStart : null;
        })()
      );
    }
  };
  sender.on('request', listener);
  try {
    await send(sender, action.payload!);
    // The original send helper already bounds reconciliation at 5 seconds.
    // Bounded header wait is observation, not response-end or server-latency proof.
    let timer: ReturnType<typeof setTimeout>;
    try {
      await Promise.race([
        Promise.all(pending),
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(Error('Send headers unavailable')),
            5000
          );
        }),
      ]);
    } finally {
      clearTimeout(timer!);
    }
    expect(matches).toHaveLength(1);
    const backend = await readCenterEditWindow(observer, channel);
    const author = action.kind === 'own-send' ? '~zod' : '~ten',
      wireText = action.payload + ' ';
    const rows = (Object.values(backend.body.posts ?? {}) as any[]).filter(
      (p) =>
        p.essay?.author === author &&
        JSON.stringify(p.essay.content) ===
          JSON.stringify([{ inline: [wireText] }])
    );
    expect(rows).toHaveLength(1);
    return {
      postId: canonical(String(rows[0].seal.id)),
      author,
      wireText,
      channel,
      request: matches[0],
      backend,
    };
  } finally {
    sender.off('request', listener);
  }
}

export async function runSeededSession(
  admin: Page,
  ten: Page,
  browser: Browser,
  testInfo: TestInfo,
  seed: number,
  actionCount: number
) {
  const plan = seededSessionPlan(seed, actionCount);
  const fixture = await preparePendingNavigation(admin, browser, 'reply-sync');
  const { page, row } = fixture;
  let global:
    | Awaited<ReturnType<typeof startScrollNavigationTrace>>
    | undefined;
  let events: Awaited<ReturnType<typeof observeActions>> | undefined;
  let reading: Awaited<ReturnType<typeof acquireReading>> | undefined;
  let input: Awaited<ReturnType<typeof startScrollInputTrace>> | undefined;
  let semantic:
    | Awaited<ReturnType<typeof startConversationSemanticTrace>>
    | undefined;
  const proof: any = {
    plan,
    ledger: [],
    blocks: [],
    pending: fixture.proof,
    initialRows: fixture.channelRows,
    initialBackend: fixture.readerBackend,
    errors: [],
  };
  const completedCaptures: {
    target: Record<string, unknown>;
    name: 'input' | 'semantic' | 'reading';
    stop: () => Promise<unknown>;
  }[] = [];
  let activePresence = false;
  let wheelClient: CDPSession | undefined;
  try {
    await helpers.inviteMembersToGroup(page, ['ten']);
    await helpers.acceptGroupInvite(ten, '~ten, ~zod');
    await helpers.navigateToChannel(ten, 'General');
    await helpers.navigateToChannel(page, 'General');
    await ten.setViewportSize({ width: 1280, height: 800 });
    expect(new URL(ten.url()).pathname).toBe(fixture.channelRoute);
    await row.scrollIntoViewIfNeeded();
    const list = await resolvePostScroller(row);
    await settlePostScroller(list);
    const box = await list.boundingBox();
    if (!box) throw Error('No actual conversation viewport');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    const offset = await row.evaluate(
      (row, list) =>
        row.getBoundingClientRect().top -
        list.getBoundingClientRect().top -
        list.clientTop -
        100,
      list
    );
    await page.mouse.wheel(0, offset);
    await settlePostScroller(list);
    const baseline = await readNavigationAnchor(row, fixture.anchorText);
    expect(baseline.bottomGap).toBeGreaterThan(100);
    await expect(row.getByText('18 replies', { exact: true })).toBeVisible();
    fixture.proof.before = await readNavigationQueries(
      page,
      fixture.proof.parentId
    );
    expect(fixture.proof.before.threadQueryPresent).toBe(false);
    const preparation = await page.evaluate(() => ({
      timeOrigin: performance.timeOrigin,
      origin: location.origin,
      scope: location.pathname,
      normalFlags: (window as any).TLON_IS_E2E !== true,
      ship: (window as any).ship,
      declaredAt: performance.now(),
    }));
    proof.session = {
      ...preparation,
      token: randomUUID(),
      channel: fixture.proof.sourceChannel,
      headed: testInfo.project.use.headless === false,
      viewport: { width: 1280, height: 800 },
      browser: browser.version(),
    };
    try {
      wheelClient = await page.context().newCDPSession(page);
      const version = await wheelClient.send('Browser.getVersion');
      const { targetInfo: target } = await wheelClient.send(
        'Target.getTargetInfo'
      );
      proof.session.wheelSource = { version, target };
    } catch (error) {
      proof.session.wheelSource = { error: String(error) };
    }
    proof.session.sender = await ten.evaluate(() => ({
      timeOrigin: performance.timeOrigin,
      origin: location.origin,
      scope: location.pathname,
      ship: (window as any).ship,
      normalFlags: (window as any).TLON_IS_E2E !== true,
    }));
    const pendingPlan: ScrollNavigationPlan = {
      version: 1,
      declaredAt: preparation.declaredAt,
      initial: 'channel',
      scopes: {
        channel: {
          kind: 'channel',
          route: fixture.channelRoute,
          rows: fixture.channelRows,
          landing: {
            kind: 'anchor',
            rowId: baseline.rowId,
            top: baseline.top,
            pointTop: baseline.pointTop,
          },
        },
        thread: {
          kind: 'thread',
          route: fixture.threadRoute,
          rows: {
            [fixture.proof.parentId]:
              fixture.proof.expectedRows[fixture.proof.parentId],
          },
          landing: { kind: 'bottom', newestId: fixture.proof.parentId },
        },
      },
      commands: [
        {
          id: 'open-thread',
          from: 'channel',
          to: 'thread',
          trigger: { kind: 'click', text: '18 replies' },
        },
        {
          id: 'return-channel',
          from: 'thread',
          to: 'channel',
          trigger: { kind: 'popstate' },
          cancelsPending: 'open-thread',
        },
      ],
      maxGapMs: 100,
      maxMeasurementMs: 32,
      maxOutgoingMs: 250,
      completionMs: 1000,
      quietTailMs: 1000,
      tolerancePx: 1,
    };
    proof.pendingPlan = pendingPlan;
    await testInfo.attach('seeded-session-plan', {
      body: JSON.stringify({
        plan,
        session: proof.session,
        initialRows: proof.initialRows,
        pendingPlan,
      }),
      contentType: 'application/json',
    });
    global = await startScrollNavigationTrace(
      page,
      pendingPlan,
      baseline.viewport
    );
    events = await observeActions(page);
    const sequenceStart = await now(page);
    await page.waitForTimeout(250);
    const corpus = { ...fixture.channelRows };
    let block: any;
    for (const action of plan.actions) {
      if ((await now(page)) - sequenceStart >= plan.limits.sequenceDeadlineMs)
        throw Error('Predeclared sequence deadline exceeded');
      const entry: any = {
        action,
        sessionToken: proof.session.token,
        ...(await page.evaluate(() => ({
          start: performance.now(),
          timeOrigin: performance.timeOrigin,
          scope: location.pathname,
        }))),
      };
      proof.ledger.push(entry);
      try {
        switch (action.kind) {
          case 'open-thread':
            await global.begin('open-thread');
            await row
              .getByText('18 replies', { exact: true })
              .click({ timeout: 10000 });
            await global.end('open-thread');
            await fixture.gate.requested();
            await page.waitForTimeout(200);
            fixture.proof.local = await readNavigationQueries(
              page,
              fixture.proof.parentId
            );
            break;
          case 'back':
            await global.begin('return-channel');
            await page.goBack({ timeout: 3000 });
            await global.end('return-channel');
            await page.waitForTimeout(200);
            fixture.gate.release();
            await fixture.gate.completed();
            proof.pendingEnd = fixture.proof.requests[0].completedTime! + 1200;
            await waitUntil(page, proof.pendingEnd);
            break;
          case 'wheel': {
            block = { index: action.block };
            proof.blocks.push(block);
            const current = await resolvePostScroller(
              page.locator('[data-postid]:visible').first()
            );
            const viewport = await current.boundingBox();
            if (!viewport) throw Error('Retained conversation unavailable');
            await page.mouse.move(
              viewport.x + viewport.width / 2,
              viewport.y + viewport.height / 2
            );
            const dispatch = {
              actionId: action.id,
              sessionToken: proof.session.token,
              targetId: proof.session.wheelSource?.target?.targetId,
              deltaX: 0,
              deltaY: action.wheelY,
              before: await readWheelSurface(page, wheelClient),
              start: await now(page),
              commandReturnedAt: NaN,
              receipt: undefined as unknown,
              end: NaN,
              after: undefined as unknown,
            };
            entry.wheelDispatch = dispatch;
            // The seeded quantity remains the exact original driver command.
            await page.mouse.wheel(0, action.wheelY!);
            dispatch.commandReturnedAt = await now(page);
            dispatch.receipt = await events.evaluate(
              (observer, start) => observer.waitForWheel(start),
              dispatch.start
            );
            dispatch.end = await now(page);
            dispatch.after = await readWheelSurface(page, wheelClient);
            await settlePostScroller(current);
            reading = await acquireReading(page, current, corpus);
            block.readingContract = reading.contract;
            if (plan.blocks[action.block].kind === 'thinking')
              semantic = await startConversationSemanticTrace(current);
            break;
          }
          case 'grow': {
            const composer = page.getByTestId('MessageInput');
            await composer.focus();
            const ih = await composer.elementHandle(),
              sh = await page
                .getByTestId('MessageInputSendButton')
                .elementHandle();
            if (!ih || !sh) throw Error('Real composer handles unavailable');
            input = await startScrollInputTrace(ih, sh, [
              { kind: 'input', payload: action.payload! },
              { kind: 'select-all', payload: 'ControlOrMeta+A' },
              { kind: 'input', payload: '' },
            ]);
            await input.beginInput(0);
            await composer.fill(action.payload!);
            await input.endInput(0);
            await page.waitForTimeout(350);
            break;
          }
          case 'remote-send':
          case 'own-send':
            Object.assign(
              entry,
              await sendWithReceipt(
                action.kind === 'own-send' ? page : ten,
                page,
                action,
                proof.session.channel,
                proof.session.timeOrigin
              )
            );
            corpus[entry.postId] = entry.wireText;
            break;
          case 'select-all':
            await input!.beginInput(1);
            await page.getByTestId('MessageInput').press('ControlOrMeta+A');
            await input!.endInput(1);
            await page.waitForTimeout(150);
            break;
          case 'delete':
            await input!.beginInput(2);
            await page.getByTestId('MessageInput').press('Delete');
            await input!.endInput(2);
            block.inputEnd = (await now(page)) + 1300;
            await waitUntil(page, block.inputEnd);
            await input!.freeze();
            completedCaptures.push({
              target: block,
              name: 'input',
              stop: input!.stop,
            });
            input = undefined;
            break;
          case 'presence-show':
          case 'presence-clear': {
            const requestedPresence = action.kind === 'presence-show';
            // A failed clear may already have reached the ship; retain cleanup
            // ownership until its actual observer readback acknowledges absence.
            if (requestedPresence) activePresence = true;
            entry.presence = await setComputingPresence(
              ten,
              requestedPresence,
              page
            );
            if (!requestedPresence) activePresence = false;
            entry.presenceCompleted = await now(page);
            if (!activePresence && plan.blocks[action.block].clearFirst) {
              await waitUntil(page, entry.start + 2000);
              await expect(
                page.getByText('Thinking...', { exact: true })
              ).toHaveCount(0, { timeout: 5000 });
              block.hiddenAt = await now(page);
            }
            break;
          }
          case 'latest': {
            block.readingContract.terminalTime =
              await reading!.capture.markTerminal();
            block.readingContract.coverage.endTime =
              block.readingContract.terminalTime + 1000;
            await waitUntil(page, block.readingContract.coverage.endTime);
            await reading!.capture.freeze();
            completedCaptures.push({
              target: block,
              name: 'reading',
              stop: reading!.capture.stop,
            });
            reading = undefined;
            if (semantic) {
              await semantic.freeze();
              completedCaptures.push({
                target: block,
                name: 'semantic',
                stop: semantic.stopRaw,
              });
              semantic = undefined;
            }
            // The logical Latest dispatch begins only after the predeclared READ tail.
            entry.start = await now(page);
            await page
              .getByTestId('ScrollToBottomButton')
              .click({ timeout: 5000 });
            await page.waitForTimeout(1000);
            break;
          }
        }
      } catch (error) {
        entry.error = String(error);
        throw error;
      } finally {
        entry.end = await now(page);
      }
    }
    proof.finalBackend = await readCenterEditWindow(
      page,
      proof.session.channel
    );
    await page.waitForTimeout(1000);
  } catch (error) {
    proof.errors.push(String(error));
  } finally {
    // Freeze every live observer before returning any large trace. Completed
    // phase handles stay bound to their original block until this final drain.
    for (const [name, capture] of [
      ['input', input],
      ['semantic', semantic],
      ['reading', reading?.capture],
    ] as const) {
      if (!capture) continue;
      try {
        await capture.freeze();
      } catch (error) {
        proof.errors.push(`${name} freeze: ${String(error)}`);
      }
      proof.partial ??= {};
      const target = proof.partial;
      completedCaptures.push({
        target,
        name,
        stop: async () => {
          const raw =
            name === 'semantic'
              ? await (capture as NonNullable<typeof semantic>).stopRaw()
              : await (capture as NonNullable<typeof input>).stop();
          if (proof.blocks.length) proof.blocks.at(-1)[name] = raw;
          return raw;
        },
      });
    }
    if (global)
      try {
        await global.freeze();
      } catch (error) {
        proof.errors.push(`Global freeze: ${String(error)}`);
      }
    if (events)
      try {
        // Deliberately do not return the retained event array until export.
        await events.evaluate((e) => {
          e.stop();
        });
      } catch (error) {
        proof.errors.push(`Events freeze: ${String(error)}`);
      }
    for (const { target, name, stop } of completedCaptures)
      try {
        target[name] = await stop();
      } catch (error) {
        proof.errors.push(`${name} export: ${String(error)}`);
      }
    if (global)
      try {
        proof.trace = await global.stop();
      } catch (error) {
        proof.errors.push(String(error));
      }
    if (events)
      try {
        proof.deliveries = await events.evaluate((e) => e.stop());
        proof.wheels = proof.deliveries.events.filter(
          (e: any) => e.type === 'wheel'
        );
      } catch (error) {
        proof.errors.push(String(error));
      } finally {
        await events.dispose().catch((error) => {
          proof.errors.push(`Events disposal: ${String(error)}`);
        });
      }
    if (wheelClient)
      await wheelClient.detach().catch((error) => {
        proof.errors.push(`Wheel CDP disposal: ${String(error)}`);
      });
    proof.sessionAfter = await page
      .evaluate(() => ({
        timeOrigin: performance.timeOrigin,
        scope: location.pathname,
        origin: location.origin,
        viewport: { width: innerWidth, height: innerHeight },
      }))
      .catch((error) => ({ error: String(error) }));
    proof.senderAfter = await ten
      .evaluate(() => ({
        timeOrigin: performance.timeOrigin,
        origin: location.origin,
        scope: location.pathname,
        ship: (window as any).ship,
        normalFlags: (window as any).TLON_IS_E2E !== true,
      }))
      .catch((error) => ({ error: String(error) }));
    await finalizeSeededSessionEvidence(
      testInfo,
      proof,
      activePresence,
      () => setComputingPresence(ten, false, page),
      () => fixture.cleanup()
    );
  }
  const result = assessSeededSession(proof);
  await testInfo.attach('seeded-session-assessment', {
    body: JSON.stringify(result),
    contentType: 'application/json',
  });
  expect(proof.errors, 'No unexecuted suffix or capture failure').toEqual([]);
  expect(
    result.issues,
    'Independent sampled behavior, with presentation/caret/soak separate'
  ).toEqual([]);
}

/** Owned teardown must run even when retaining raw evidence fails. */
export async function finalizeSeededSessionEvidence(
  testInfo: Pick<TestInfo, 'attach'>,
  proof: { errors: string[] },
  activePresence: boolean,
  clearPresence: () => Promise<unknown>,
  cleanupFixture: () => Promise<unknown>
) {
  const cleanup = {
    presenceWasPending: activePresence,
    errors: [] as string[],
  };
  try {
    await testInfo.attach('seeded-session-raw', {
      body: JSON.stringify(proof),
      contentType: 'application/json',
    });
  } catch (error) {
    cleanup.errors.push(`Raw attachment: ${String(error)}`);
  } finally {
    if (activePresence)
      try {
        await clearPresence();
      } catch (error) {
        cleanup.errors.push(`Presence cleanup: ${String(error)}`);
      }
    try {
      await cleanupFixture();
    } catch (error) {
      cleanup.errors.push(
        `Pending navigation/context cleanup: ${String(error)}`
      );
    }
    try {
      await testInfo.attach('seeded-session-cleanup', {
        body: JSON.stringify(cleanup),
        contentType: 'application/json',
      });
    } catch (error) {
      cleanup.errors.push(`Cleanup attachment: ${String(error)}`);
    }
    proof.errors.push(...cleanup.errors);
  }
  return cleanup;
}
