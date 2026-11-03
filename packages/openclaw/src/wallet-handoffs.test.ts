import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createWalletHandoffs } from './wallet-handoffs.js';
type Deps = Parameters<typeof createWalletHandoffs>[0];
type Row = NonNullable<Awaited<ReturnType<Deps['store']['lookup']>>>;
const services: ReturnType<typeof createWalletHandoffs>[] = [];
beforeEach(() => vi.useFakeTimers());
afterEach(async () => {
  await Promise.all(services.splice(0).map((s) => s.stop()));
  vi.useRealTimers();
});
function fixture() {
  const records = new Map<string, Row>();
  const store: Deps['store'] = {
    register: async (key, value) => {
      records.set(key, structuredClone(value));
    },
    registerIfAbsent: async (key, value) => {
      if (records.has(key)) return false;
      records.set(key, structuredClone(value));
      return true;
    },
    lookup: async (key) => structuredClone(records.get(key)),
    consume: async (key) => {
      const row = records.get(key);
      records.delete(key);
      return row;
    },
    delete: async (key) => records.delete(key),
    entries: async () =>
      [...records].map(([key, value]) => ({
        key,
        value: structuredClone(value),
        createdAt: 0,
      })),
    clear: async () => {
      records.clear();
    },
  };
  const deps = {
    store,
    read: vi.fn().mockResolvedValue({ status: 'pending' }),
    send: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue({}),
    sessionIdFor: vi.fn().mockReturnValue('conversation-1'),
    warn: vi.fn(),
  };
  const service = createWalletHandoffs(deps);
  services.push(service);
  const id = '11111111-1111-4111-8111-111111111111';
  const event = {
    toolName: 'mcp__call',
    params: { name: 'browser_wallet_connect' },
    result: {
      details: {
        structuredContent: {
          request_id: id,
          owner_action_required: true,
          expires_at: Date.now() + 600000,
        },
      },
    },
  };
  const ctx = { sessionKey: 'owner-dm', sessionId: 'conversation-1' };
  return { ...deps, records, service, event, ctx, id };
}
it('delivers one native card and resumes the original conversation once after connection', async () => {
  const f = fixture();
  await f.service.handle(f.event, f.ctx);
  await f.service.handle(f.event, f.ctx);
  expect(f.send).toHaveBeenCalledExactlyOnceWith(f.id);
  f.service.start();
  await f.service.poll();
  expect(f.resume).not.toHaveBeenCalled();
  f.read.mockResolvedValue({ status: 'connected' });
  await Promise.all([f.service.poll(), f.service.poll()]);
  await f.service.poll();
  expect(f.resume).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      sessionKey: 'owner-dm',
      idempotencyKey: `tlon-wallet:${f.id}`,
      message: expect.stringContaining(': connected.'),
    })
  );
  expect(f.records.size).toBe(0);
});
it('durably retries delivery without putting provider URLs in continuation messages', async () => {
  const f = fixture();
  f.send.mockRejectedValueOnce(new Error('unavailable'));
  await expect(f.service.handle(f.event, f.ctx)).rejects.toThrow();
  expect(f.records.size).toBe(1);
  f.service.start();
  await f.service.poll();
  expect(f.send).toHaveBeenCalledTimes(2);
  f.read.mockResolvedValue({
    status: 'ready',
    action: { url: 'https://private.example/secret' },
  });
  f.resume.mockRejectedValueOnce(new Error('temporary'));
  await f.service.poll();
  await f.service.poll();
  expect(f.resume).toHaveBeenCalledTimes(2);
  expect(f.resume.mock.calls[0][0]).toEqual(f.resume.mock.calls[1][0]);
  expect(JSON.stringify(f.resume.mock.calls)).not.toContain('private.example');
});
it('drops a pending request when its conversation has been reset', async () => {
  const f = fixture();
  await f.service.handle(f.event, f.ctx);
  f.sessionIdFor.mockReturnValue('conversation-2');
  f.service.start();
  await f.service.poll();
  expect(f.resume).not.toHaveBeenCalled();
  expect(f.records.size).toBe(0);
});
it('expiry produces a terminal notification and malformed or failed calls produce no card', async () => {
  const f = fixture();
  await f.service.handle({ ...f.event, error: 'failed' }, f.ctx);
  expect(f.send).not.toHaveBeenCalled();
  await f.service.handle(f.event, f.ctx);
  vi.setSystemTime(Date.now() + 600001);
  f.service.start();
  await f.service.poll();
  expect(f.resume).toHaveBeenCalledWith(
    expect.objectContaining({ message: expect.stringContaining(': expired.') })
  );
});
