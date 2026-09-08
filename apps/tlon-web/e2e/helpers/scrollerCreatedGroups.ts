import type { Page, Request, Response } from '@playwright/test';
import { randomUUID } from 'node:crypto';

const ORIGIN = 'http://localhost:3000';
const BACKEND = 'http://localhost:35453';
const CREATE = `${ORIGIN}/spider/groups/group-create-thread/group-create-1/group-ui-2`;
const GROUPS = `${BACKEND}/~/scry/groups/v3/groups.json`;
const flag = /^~[a-z-]+\/[a-z0-9-]+$/;
const ownFlag = /^~zod\/[a-z0-9-]+$/;
type GroupMap = Record<string, { meta: { title: string } }>;
type Creation = { id: string; headers?: number; ambiguous?: boolean };
type CleanupReceipt = {
  status: 'complete' | 'incomplete';
  scope: 'test-created-local-zod-groups';
  groups: { id: string; status: 'absent' | 'deleted' | 'incomplete' }[];
  errors: string[];
};

/** A request bound also covers a stalled response body; never reports canceled server work. */
async function bounded<T>(
  run: () => Promise<T>,
  timeoutMs: number
): Promise<T> {
  if (timeoutMs <= 0) throw new Error('Fixture cleanup budget exhausted');
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      run(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Fixture cleanup request timed out')),
          timeoutMs
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
function groupMap(value: unknown): GroupMap {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.entries(value).some(
      ([id, group]) =>
        !flag.test(id) ||
        !group ||
        typeof group !== 'object' ||
        typeof group.meta?.title !== 'string'
    )
  )
    throw new Error('Incomplete or malformed backend group map');
  return value as GroupMap;
}

/** Opt-in cleanup: only observed, acknowledged UI-created IDs absent from the baseline. */
export async function startCreatedGroupCleanup(
  page: Page,
  scope: { ship: string; url: string; webUrl: string }
) {
  if (
    scope.ship !== 'zod' ||
    scope.url !== BACKEND ||
    scope.webUrl !== ORIGIN ||
    new URL(page.url()).origin !== ORIGIN ||
    (await page.evaluate(() => (window as Window & { ship?: string }).ship)) !==
      'zod'
  )
    throw new Error(
      'Created-group cleanup requires the exact authenticated local fake zod'
    );
  const read = (timeoutMs: number) =>
    bounded(async () => {
      const response = await page.request.get(GROUPS, {
        timeout: timeoutMs,
        maxRedirects: 0,
        maxRetries: 0,
      });
      if (response.status() !== 200)
        throw new Error(`Group map GET status ${response.status()}`);
      return groupMap(await response.json());
    }, timeoutMs);
  const baseline = await read(1500);
  const requests = new Map<Request, Creation>();
  const errors: string[] = [];
  const onRequest = (request: Request) => {
    if (
      request.url() !== CREATE ||
      request.method() !== 'POST' ||
      request.frame() !== page.mainFrame()
    )
      return;
    try {
      const body = request.postDataJSON();
      if (
        !ownFlag.test(body?.groupId) ||
        !Array.isArray(body.guestList) ||
        body.guestList.length ||
        !Array.isArray(body.channels) ||
        !body.channels.length ||
        body.channels.some(
          (c: { channelId?: string }) =>
            !/^chat\/~zod\/[a-z0-9-]+$/.test(c.channelId ?? '')
        ) ||
        typeof body.meta?.title !== 'string'
      )
        throw new Error('Unqualified fixture group-create request');
      if (Object.hasOwn(baseline, body.groupId))
        throw new Error(`Refusing preexisting group ${body.groupId}`);
      const creation: Creation = { id: body.groupId };
      for (const earlier of requests.values())
        if (earlier.id === creation.id) {
          earlier.ambiguous = true;
          creation.ambiguous = true;
        }
      requests.set(request, creation);
    } catch (error) {
      errors.push(String(error));
    }
  };
  const onResponse = (response: Response) => {
    const creation = requests.get(response.request());
    if (creation) creation.headers = response.status();
  };
  page.on('request', onRequest);
  page.on('response', onResponse);
  let pending: Promise<CleanupReceipt> | undefined;
  return {
    finish() {
      page.off('request', onRequest);
      page.off('response', onResponse);
      return (pending ??= (async () => {
        const deadline = Date.now() + 8000;
        const budget = () => Math.min(1500, deadline - Date.now());
        const receipt: CleanupReceipt = {
          status: 'complete',
          scope: 'test-created-local-zod-groups',
          groups: [],
          errors: [...errors],
        };
        const airlock = `${BACKEND}/~/channel/scroller-cleanup-${randomUUID()}`;
        let opened = false,
          actionId = 0;
        try {
          for (const creation of requests.values()) {
            const item: CleanupReceipt['groups'][number] = {
              id: creation.id,
              status: 'incomplete',
            };
            receipt.groups.push(item);
            if (creation.headers !== 200 || creation.ambiguous) {
              receipt.errors.push(
                `Unacknowledged or ambiguous creation ${creation.id}`
              );
              continue;
            }
            const current = await read(budget());
            if (!Object.hasOwn(current, creation.id)) {
              item.status = 'absent';
              continue;
            }
            const timeout = budget();
            opened = true;
            await bounded(async () => {
              const response = await page.request.put(airlock, {
                timeout,
                maxRedirects: 0,
                maxRetries: 0,
                data: [
                  {
                    id: ++actionId,
                    action: 'poke',
                    ship: 'zod',
                    app: 'groups',
                    mark: 'group-action-5',
                    json: {
                      group: { flag: creation.id, 'a-group': { delete: null } },
                    },
                  },
                ],
              });
              if (response.status() !== 200 && response.status() !== 204)
                throw new Error(`Delete transport status ${response.status()}`);
            }, timeout);
            // Fresh reads start only after the mutation response. Never infer success from PUT.
            for (let attempt = 0; attempt < 3; attempt++) {
              if (!Object.hasOwn(await read(budget()), creation.id)) {
                item.status = 'deleted';
                break;
              }
              if (attempt < 2)
                await bounded(
                  () =>
                    new Promise<void>((resolve) => setTimeout(resolve, 100)),
                  budget()
                );
            }
            if (item.status !== 'deleted')
              receipt.errors.push(`Backend still contains ${creation.id}`);
          }
        } catch (error) {
          receipt.errors.push(String(error));
        } finally {
          if (opened)
            try {
              await bounded(async () => {
                const response = await page.request.post(airlock, {
                  timeout: 1000,
                  maxRedirects: 0,
                  maxRetries: 0,
                  data: [{ id: ++actionId, action: 'delete' }],
                });
                if (response.status() !== 200 && response.status() !== 204)
                  throw new Error(`Airlock close status ${response.status()}`);
              }, 1000);
            } catch (error) {
              receipt.errors.push(String(error));
            }
        }
        if (
          receipt.errors.length ||
          receipt.groups.some((g) => g.status === 'incomplete')
        )
          receipt.status = 'incomplete';
        return receipt;
      })());
    },
  };
}
