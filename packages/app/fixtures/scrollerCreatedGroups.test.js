import { describe, expect, it, vi } from 'vitest';
import { startCreatedGroupCleanup } from '../../../apps/tlon-web/e2e/helpers/scrollerCreatedGroups';
const scope = {
  ship: 'zod',
  url: 'http://localhost:35453',
  webUrl: 'http://localhost:3000',
};
const path = `${scope.webUrl}/spider/groups/group-create-thread/group-create-1/group-ui-2`;
function rig() {
  let groups = {
    '~zod/existing': { meta: { title: 'Untitled group' } },
  };
  const handlers = new Map();
  const calls = [];
  const main = {};
  const response = (body, status = 200) => ({
    status: () => status,
    json: async () => body,
  });
  const request = {
    get: vi.fn(async (url, options) => {
      calls.push(['get', url, options]);
      return response(structuredClone(groups));
    }),
    put: vi.fn(async (url, options) => {
      calls.push(['put', url, options]);
      delete groups[options.data[0].json.group.flag];
      return response({}, 204);
    }),
    post: vi.fn(async (url, options) => {
      calls.push(['post', url, options]);
      return response({}, 204);
    }),
  };
  const page = {
    url: () => `${scope.webUrl}/apps/groups/`,
    evaluate: async () => 'zod',
    mainFrame: () => main,
    request,
    on: (event, f) => handlers.set(event, f),
    off: (event) => handlers.delete(event),
  };
  const create = (id = '~zod/new', options = {}) => {
    const body = {
      groupId: id,
      meta: { title: 'Untitled group' },
      guestList: options.guests ?? [],
      channels: [{ channelId: 'chat/~zod/chat' }],
    };
    const req = {
      url: () => options.url ?? path,
      method: () => 'POST',
      frame: () => (options.main === false ? {} : main),
      postDataJSON: () => body,
    };
    handlers.get('request')?.(req);
    groups[id] = { meta: body.meta };
    if (!options.pending)
      handlers.get('response')?.({
        request: () => req,
        status: () => options.status ?? 200,
      });
  };
  return {
    page,
    request,
    handlers,
    calls,
    create,
    response,
    get groups() {
      return groups;
    },
    set groups(value) {
      groups = value;
    },
  };
}
const start = (r, s = scope) => startCreatedGroupCleanup(r.page, s);
describe('exact test-created fake-ship cleanup', () => {
  it('deletes only acknowledged new request ID; preserves identical-title and concurrent unrelated groups', async () => {
    const r = rig(),
      c = await start(r);
    r.create();
    r.groups['~zod/unrelated'] = { meta: { title: 'Untitled group' } };
    const result = await c.finish();
    expect(result.status).toBe('complete');
    expect(result.groups).toEqual([{ id: '~zod/new', status: 'deleted' }]);
    expect(Object.keys(r.groups).sort()).toEqual([
      '~zod/existing',
      '~zod/unrelated',
    ]);
    expect(r.calls.map((c) => c[0])).toEqual([
      'get',
      'get',
      'put',
      'get',
      'post',
    ]);
    const put = r.calls.find((c) => c[0] === 'put');
    expect(put[2].data[0]).toMatchObject({
      ship: 'zod',
      app: 'groups',
      mark: 'group-action-5',
      json: { group: { flag: '~zod/new', 'a-group': { delete: null } } },
    });
    expect(await c.finish()).toBe(result);
    expect(r.handlers.size).toBe(0);
  });
  it.each([
    'preexisting',
    'failed',
    'pending',
    'duplicate',
    'invited',
    'foreign-host',
  ])('refuses %s ownership', async (kind) => {
    const r = rig(),
      c = await start(r);
    if (kind === 'preexisting') r.create('~zod/existing');
    if (kind === 'failed') r.create('~zod/new', { status: 500 });
    if (kind === 'pending') r.create('~zod/new', { pending: true });
    if (kind === 'duplicate') {
      r.create();
      r.create();
    }
    if (kind === 'invited') r.create('~zod/new', { guests: ['~ten'] });
    if (kind === 'foreign-host') r.create('~ten/new');
    const result = await c.finish();
    expect(result.status).toBe('incomplete');
    expect(r.request.put).not.toHaveBeenCalled();
  });
  it.each(['foreign-origin', 'iframe'])(
    'ignores unrelated %s request',
    async (kind) => {
      const r = rig(),
        c = await start(r);
      r.create(
        '~zod/new',
        kind === 'iframe'
          ? { main: false }
          : { url: path.replace('localhost:3000', 'example.com') }
      );
      expect((await c.finish()).groups).toEqual([]);
      expect(r.request.put).not.toHaveBeenCalled();
    }
  );
  it.each([
    { ...scope, ship: 'ten' },
    { ...scope, url: 'https://real.example' },
    { ...scope, webUrl: 'http://localhost:9999' },
  ])('rejects unsupported local scope %o', async (s) => {
    const r = rig();
    await expect(start(r, s)).rejects.toThrow(/exact authenticated/);
    expect(r.calls).toEqual([]);
  });
  it('malformed baseline cannot enable cleanup', async () => {
    const r = rig();
    r.request.get.mockResolvedValue(r.response({ error: 'failed' }));
    await expect(start(r)).rejects.toThrow(/malformed/);
  });
  it('redirected readback cannot prove absence', async () => {
    const r = rig(),
      c = await start(r);
    r.create();
    r.request.get.mockResolvedValue(r.response({}, 302));
    expect((await c.finish()).status).toBe('incomplete');
    expect(r.request.put).not.toHaveBeenCalled();
  });
  it('already absent owned group needs no delete transport', async () => {
    const r = rig(),
      c = await start(r);
    r.create();
    delete r.groups['~zod/new'];
    expect((await c.finish()).groups).toEqual([
      { id: '~zod/new', status: 'absent' },
    ]);
    expect(r.request.put).not.toHaveBeenCalled();
  });
  it('mutation failure remains incomplete and closes exact owned airlock', async () => {
    const r = rig(),
      c = await start(r);
    r.create();
    r.request.put.mockRejectedValue(new Error('transport failed'));
    const result = await c.finish();
    expect(result.status).toBe('incomplete');
    expect(result.errors.join()).toMatch(/transport failed/);
    expect(r.request.post).toHaveBeenCalledTimes(1);
  });
  it('successful mutation headers without durable absence remain incomplete', async () => {
    const r = rig(),
      c = await start(r);
    r.create();
    r.request.put.mockResolvedValue(r.response({}, 204));
    expect((await c.finish()).status).toBe('incomplete');
    expect(r.groups['~zod/new']).toBeDefined();
  });
  it('stalled transport is bounded and every request forbids redirects/retries', async () => {
    vi.useFakeTimers();
    try {
      const r = rig(),
        c = await start(r);
      r.create();
      r.request.put.mockImplementation(() => new Promise(() => {}));
      const done = c.finish();
      await vi.advanceTimersByTimeAsync(1501);
      const result = await done;
      expect(result.status).toBe('incomplete');
      expect(result.errors.join()).toMatch(/timed out/);
      for (const call of r.calls) {
        expect(call[2].timeout).toBeLessThanOrEqual(1500);
        expect(call[2].maxRedirects).toBe(0);
        expect(call[2].maxRetries).toBe(0);
      }
      expect(r.request.post).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
