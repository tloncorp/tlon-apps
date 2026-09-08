import {
  expect,
  type Browser,
  type Page,
  type Route,
  type TestInfo,
} from '@playwright/test';
import { randomUUID } from 'node:crypto';
import * as helpers from '../helpers';
import {
  paginationPlan,
  paginationTitle,
  paginationAttachment,
  paginationBackendRows,
  replayPaginationEvidence,
} from '../../../../scripts/scroll-stability-pagination-evidence.mjs';
import { currentLocalChannel } from './scrollerContentScenario';
import { writeReferencePosts } from './scrollerReferenceScenario';
import { resolvePostScroller, settlePostScroller } from './scrollers';
import { acquireReading } from './scrollerSeededSession';
import { startCenterEditObserver } from './scrollerCenterEdit';
import {
  startWebAssetCapture,
  dismissPersistedDevTools,
} from './scrollerWebAssets';

const now = (page: Page) => page.evaluate(() => performance.now());
const canonical = (id: string) =>
  id.replaceAll('.', '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** Read the active real infinite query; never clear, invalidate or refetch it. */
export async function readPaginationWindow(page: Page, channel: string) {
  return page.evaluate((channel) => {
    const time = performance.now();
    const client = (window as any).__tlonQueryClient;
    const queries = client
      ?.getQueryCache()
      .getAll()
      .filter(
        (q: any) =>
          q.queryKey[0] === 'channelPosts' &&
          q.queryKey[1] === channel &&
          q.getObserversCount() > 0
      );
    if (queries?.length !== 1)
      throw Error('Expected one active channel window');
    const q = queries[0],
      state = q.state;
    return {
      time,
      timeOrigin: performance.timeOrigin,
      scope: location.pathname,
      key: q.queryKey,
      status: state.status,
      fetchStatus: state.fetchStatus,
      failureCount: state.fetchFailureCount,
      pageParams: state.data?.pageParams ?? [],
      rows:
        state.data?.pages.flatMap((p: any) =>
          p.posts.map((r: any) => ({
            id: r.id,
            text: r.textContent,
            sequence: r.sequenceNum,
          }))
        ) ?? [],
      durationMs: performance.now() - time,
    };
  }, channel);
}

/** Only the exact test-owned GET fails; the sixth original request is continued. */
export async function holdPaginationRetry(
  page: Page,
  url: string,
  requests: any[]
) {
  let releaseFailure!: () => void, releaseSuccess!: () => void;
  const first = new Promise<void>((resolve) => {
    releaseFailure = resolve;
  });
  const retry = new Promise<void>((resolve) => {
    releaseSuccess = resolve;
  });
  const pending: Promise<void>[] = [];
  let retired = false;
  const handler = (route: Route) => {
    const request = route.request();
    if (request.url() !== url || request.method() !== 'GET' || retired)
      return route.continue();
    const index = requests.length,
      record: any = { url, method: 'GET', start: NaN };
    requests.push(record);
    const task = (async () => {
      try {
        record.start = await now(page);
        if (index === 0) await first;
        if (index === 5) await retry;
        record.release = await now(page);
        if (retired) {
          record.outcome = 'cleanup';
          await route.continue();
        } else if (index < 5) {
          record.outcome = 'aborted';
          await route.abort('failed');
        } else {
          record.outcome = 'continued';
          await route.continue();
          const response = await request.response();
          if (!response) throw Error('Original range GET had no response');
          const error = await response.finished();
          if (error) throw error;
          record.status = response.status();
          record.body = await response.json();
        }
        record.end = await now(page);
      } catch (error) {
        record.error = String(error);
      }
    })();
    pending.push(task);
    return task;
  };
  await page.route(url, handler);
  return {
    releaseFailure,
    releaseSuccess,
    async cleanup() {
      retired = true;
      releaseFailure();
      releaseSuccess();
      await page.unroute(url, handler);
      await Promise.race([
        Promise.allSettled(pending),
        page.waitForTimeout(5000),
      ]);
    },
  };
}

export async function runPaginationScenario(
  admin: Page,
  browser: Browser,
  testInfo: TestInfo
) {
  const startedWall = Date.now();
  const plan = paginationPlan(randomUUID().slice(0, 8));
  const proof: any = { plan, requests: [], phases: [], moves: [], errors: [] };
  const groupName = `Pagination ${plan.token}`;
  await helpers.createGroup(admin);
  await helpers.openGroupCustomization(admin);
  await helpers.changeGroupName(admin, groupName);
  await helpers.navigateBack(admin);
  await admin.getByTestId('HomeNavIcon').click();
  await admin.getByTestId(`GroupListItem-${groupName}-unpinned`).click();
  await helpers.navigateToChannel(admin, 'General');
  const { channelId: channel, origin } = currentLocalChannel(admin);
  const route = new URL(admin.url()).pathname;
  proof.channel = channel;
  await writeReferencePosts(
    admin.request,
    channel,
    plan.corpus.map((text) => [{ inline: [text] }])
  );
  await expect
    .poll(
      async () => {
        const url = `${origin}/~/scry/channels/v5/${channel}/posts/newest/150/post.json`;
        const startWall = Date.now(),
          response = await admin.request.get(url);
        const body = await response.json();
        proof.backend = {
          url,
          startWall,
          endWall: Date.now(),
          status: response.status(),
          body,
        };
        const rows = paginationBackendRows(proof.backend.body);
        return (
          rows?.length === 120 &&
          plan.corpus.every(
            (text) => rows.filter((r: any) => r.text === text).length === 1
          )
        );
      },
      { timeout: 30_000 }
    )
    .toBe(true);
  const corpus = Object.fromEntries(
    paginationBackendRows(proof.backend.body)!.map((r: any) => [
      canonical(r.id),
      r.text,
    ])
  );
  const auth = await admin.context().storageState();
  proof.freshContext = {
    storage: 'cookies-and-localStorage-only',
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
  const page = await context.newPage();
  let gate: Awaited<ReturnType<typeof holdPaginationRetry>> | undefined;
  let observer: Awaited<ReturnType<typeof startCenterEditObserver>> | undefined;
  let assets: Awaited<ReturnType<typeof startWebAssetCapture>> | undefined;
  const captures: Awaited<ReturnType<typeof acquireReading>>[] = [];
  let failure: unknown;
  try {
    await admin.close();
    await page.goto(`${origin}/apps/groups/`);
    await expect(page.getByText('Home', { exact: true })).toBeVisible({
      timeout: 60_000,
    });
    await dismissPersistedDevTools(page);
    assets = await startWebAssetCapture(page);
    proof.assets = assets.assets;
    await page.getByTestId(`GroupListItem-${groupName}-unpinned`).click();
    await helpers.navigateToChannel(page, 'General');
    await expect.poll(() => new URL(page.url()).pathname).toBe(route);
    await expect(page.getByTestId('MessageInput')).toBeVisible({
      timeout: 60_000,
    });
    await expect
      .poll(
        async () => {
          const q = await readPaginationWindow(page, channel);
          return q.rows.length >= 20 && q.fetchStatus === 'idle';
        },
        { timeout: 30_000 }
      )
      .toBe(true);
    const list = await resolvePostScroller(
      page.locator('[data-postid]:visible').first()
    );
    await settlePostScroller(list);
    proof.before = await readPaginationWindow(page, channel);
    const cursor = Math.min(...proof.before.rows.map((r: any) => r.sequence));
    expect(cursor).toBeGreaterThan(30);
    const url = `${origin}/~/scry/channels/v5/${channel}/posts/range/${cursor - 30}/${cursor}/outline.json`;
    gate = await holdPaginationRetry(page, url, proof.requests);
    proof.session = {
      ...(await page.evaluate(() => ({
        time: performance.now(),
        timeOrigin: performance.timeOrigin,
        scope: location.pathname,
        origin: location.origin,
        ship: (window as any).ship,
        e2eMode: (window as any).TLON_IS_E2E === true,
      }))),
      headed: testInfo.project.use.headless === false,
      browser: browser.version(),
      viewport: page.viewportSize(),
    };
    await testInfo.attach('pagination-retry-plan', {
      body: JSON.stringify({
        plan,
        channel,
        session: proof.session,
        freshContext: proof.freshContext,
      }),
      contentType: 'application/json',
    });
    observer = await startCenterEditObserver(list, proof.before.rows[0].id);
    const bounds = await list.boundingBox();
    if (!bounds) throw Error('Current reader viewport missing');
    await page.mouse.move(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2
    );
    const initial: any = { kind: 'initial', start: await now(page) };
    proof.moves.push(initial);
    for (let n = 0; n < 12 && proof.requests.length === 0; n++) {
      await page.mouse.wheel(0, -1200);
      await settlePostScroller(list);
    }
    initial.end = await now(page);
    expect(proof.requests).toHaveLength(1);
    captures.push(await acquireReading(page, list, corpus));
    await captures[0].capture.wait(270);
    gate.releaseFailure();
    await expect
      .poll(
        async () => {
          const q = await readPaginationWindow(page, channel);
          return (
            proof.requests.length === 5 &&
            proof.requests.every((r: any) => Number.isFinite(r.end)) &&
            q.status === 'error' &&
            q.fetchStatus === 'idle'
          );
        },
        { timeout: 10_000 }
      )
      .toBe(true);
    proof.failed = await readPaginationWindow(page, channel);
    const failedTerminal = await captures[0].capture.markTerminal();
    Object.assign(captures[0].contract, { terminalTime: failedTerminal });
    captures[0].contract.coverage.endTime = failedTerminal + 1000;
    await captures[0].capture.wait(1000);
    await captures[0].capture.freeze();

    const away: any = { kind: 'away', start: await now(page) };
    proof.moves.push(away);
    await page.mouse.wheel(0, bounds.height * 2);
    await settlePostScroller(list);
    Object.assign(
      away,
      await list.evaluate((el) => ({
        offset: el.scrollTop,
        height: el.clientHeight,
      }))
    );
    away.end = await now(page);
    expect(away.offset).toBeGreaterThan(away.height);
    const retry: any = { kind: 'retry', start: await now(page) };
    proof.moves.push(retry);
    await page.mouse.wheel(0, -bounds.height * 2);
    await settlePostScroller(list);
    retry.end = await now(page);
    await expect.poll(() => proof.requests.length, { timeout: 2500 }).toBe(6);
    proof.retryPending = await readPaginationWindow(page, channel);
    captures.push(await acquireReading(page, list, corpus));
    await captures[1].capture.wait(270);
    gate.releaseSuccess();
    await expect
      .poll(
        async () => {
          const q = await readPaginationWindow(page, channel);
          return (
            Number.isFinite(proof.requests[5]?.end) &&
            q.fetchStatus === 'idle' &&
            q.rows.length > proof.before.rows.length
          );
        },
        { timeout: 10_000 }
      )
      .toBe(true);
    proof.after = await readPaginationWindow(page, channel);
    const terminal = await captures[1].capture.markTerminal();
    Object.assign(captures[1].contract, { terminalTime: terminal });
    captures[1].contract.coverage.endTime = terminal + 1000;
    await captures[1].capture.wait(1000);
    await captures[1].capture.freeze();
    await observer.freeze();
  } catch (error) {
    failure = error;
    proof.errors.push(String(error));
  } finally {
    // Freeze before transfer; cleanup runs even if capture/export/attachment fails.
    for (const r of captures)
      await r.capture.freeze().catch((e) => proof.errors.push(String(e)));
    await observer?.freeze().catch((e) => proof.errors.push(String(e)));
    try {
      for (const r of captures) {
        try {
          proof.phases.push({
            contract: r.contract,
            raw: await r.capture.stop(),
          });
        } catch (error) {
          proof.errors.push(String(error));
        }
      }
      try {
        if (observer) proof.observer = await observer.stop();
      } catch (error) {
        proof.errors.push(String(error));
      }
      try {
        const assetProof = await assets?.finish();
        proof.assetProof = assetProof;
        if (assetProof)
          await testInfo.attach('pagination-asset-proof', {
            body: JSON.stringify(assetProof),
            contentType: 'application/json',
          });
      } catch (error) {
        proof.errors.push(String(error));
      }
    } finally {
      assets?.dispose();
      proof.cleanup = { gatesReleased: false, contextClosed: false };
      try {
        await gate?.cleanup();
        proof.cleanup.gatesReleased = true;
      } catch (error) {
        proof.errors.push(`Gate cleanup: ${error}`);
      }
      try {
        await context.close();
        proof.cleanup.contextClosed = true;
      } catch (error) {
        proof.errors.push(`Context cleanup: ${error}`);
      }
      await testInfo.attach(paginationAttachment, {
        body: JSON.stringify(proof),
        contentType: 'application/json',
      });
    }
  }
  if (failure) throw failure;
  const assessment = replayPaginationEvidence(proof, {
    title: paginationTitle,
    startTime: new Date(startedWall).toISOString(),
    duration: Date.now() - startedWall,
  });
  await testInfo.attach('pagination-retry-assessment', {
    body: JSON.stringify(assessment),
    contentType: 'application/json',
  });
  expect(assessment.verdict, JSON.stringify(assessment.issues)).toBe('PASS');
}
