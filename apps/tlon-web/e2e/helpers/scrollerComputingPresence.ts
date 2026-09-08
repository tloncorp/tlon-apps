import { expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

// Exact existing local-fake-ship operation, shared without changing its payload or deadlines.
export async function setComputingPresence(
  page: Page,
  active: boolean,
  observer: Page
) {
  const origin = new URL(page.url()).origin;
  expect(['http://localhost:3000', 'http://localhost:3002']).toContain(origin);
  const channelId = decodeURIComponent(
    new URL(page.url()).pathname.split('/channel/')[1] ?? ''
  ).replace(/\/$/, '');
  expect(channelId).toMatch(/^chat\/~[^/]+\/[^/]+$/);
  const context = `/channel/${channelId}`;
  const ship = await page.evaluate(() => (window as any).ship as string);
  expect(['zod', 'ten']).toContain(ship);
  const key = { context, ship: `~${ship}`, topic: 'computing' };
  const json = active
    ? {
        set: {
          key,
          disclose: [],
          timeout: null,
          display: {
            icon: null,
            text: 'Scroll stability computing',
            blob: JSON.stringify({
              protocol: 'tlon.computing-status.v1',
              thinking: true,
              toolCalls: [],
            }),
          },
        },
      }
    : { clear: key };
  const airlock = `${origin}/~/channel/scroller-${randomUUID()}`;
  let observerBody: unknown;
  let observerStatus = 0;
  try {
    const response = await page.request.put(airlock, {
      data: [
        {
          id: 1,
          action: 'poke',
          ship,
          app: 'presence',
          mark: 'presence-action-1',
          json,
        },
      ],
    });
    expect(response.ok(), 'Presence poke transport succeeded').toBe(true);
    await expect
      .poll(
        async () => {
          // The host excludes the sender from its fanout, so verify the
          // actual observer/host whose UI this test records.
          const observerOrigin = new URL(observer.url()).origin;
          expect(['http://localhost:3000', 'http://localhost:3002']).toContain(
            observerOrigin
          );
          const state = await observer.request.get(
            `${observerOrigin}/~/scry/presence/v1/init.json`
          );
          expect(state.ok(), 'Presence agent is available').toBe(true);
          const body = await state.json();
          observerBody = body;
          observerStatus = state.status();
          expect(body).toHaveProperty('init');
          return Boolean(body.init[context]?.computing?.[`~${ship}`]);
        },
        { timeout: 10_000 }
      )
      .toBe(active);
    return {
      active,
      origin,
      observerOrigin: new URL(observer.url()).origin,
      channelId,
      ship,
      request: {
        url: airlock,
        status: response.status(),
        body: [
          {
            id: 1,
            action: 'poke',
            ship,
            app: 'presence',
            mark: 'presence-action-1',
            json,
          },
        ],
      },
      observer: { status: observerStatus, body: observerBody },
    };
  } finally {
    const closed = await page.request.post(airlock, {
      data: [{ id: 2, action: 'delete' }],
    });
    expect(closed.ok(), 'Test-owned presence airlock closed').toBe(true);
  }
}
