import { expect, it, vi } from 'vitest';
import { returnOnThreadRoute } from '../../../apps/tlon-web/e2e/helpers/scrollImmediateBack';
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
const tick = () => new Promise((resolve) => setImmediate(resolve));
function setup() {
  const route = deferred(),
    click = deferred(),
    back = deferred();
  const log = [];
  let predicate;
  const page = {
    waitForURL: vi.fn((matches, options) => {
      log.push('armed');
      predicate = matches;
      return route.promise;
    }),
    goBack: vi.fn(() => {
      log.push('back');
      return back.promise;
    }),
  };
  const trigger = {
    click: vi.fn(() => {
      log.push('click');
      return click.promise;
    }),
  };
  const capture = {
    begin: vi.fn(async (id) => {
      log.push(`begin:${id}`);
    }),
    end: vi.fn(async (id) => {
      log.push(`end:${id}`);
    }),
  };
  const run = returnOnThreadRoute(page, trigger, '/thread/exact', capture);
  run.catch(() => {});
  return {
    run,
    route,
    click,
    back,
    page,
    trigger,
    capture,
    log,
    commit(path) {
      if (predicate(new URL(path, 'http://localhost:3000'))) route.resolve();
    },
  };
}
it('dispatches real Back on exact route commit before delayed click acknowledgement, then joins both brackets', async () => {
  const t = setup();
  await tick();
  expect(t.log).toEqual(['armed', 'click']);
  t.commit('/thread/exact');
  await tick();
  expect(t.page.goBack).toHaveBeenCalledWith({ timeout: 3000 });
  expect(t.capture.end).not.toHaveBeenCalledWith('open-thread');
  t.back.resolve();
  await tick();
  expect(t.capture.end).toHaveBeenCalledWith('return-channel');
  let complete = false;
  t.run.then(() => {
    complete = true;
  });
  await tick();
  expect(complete).toBe(false);
  t.click.resolve();
  await t.run;
  expect(t.capture.end).toHaveBeenCalledWith('open-thread');
  expect(t.page.waitForURL.mock.calls[0][1]).toEqual({
    waitUntil: 'commit',
    timeout: 2000,
  });
  expect(t.trigger.click).toHaveBeenCalledWith({ timeout: 10000 });
});
it('does not dispatch Back for another route', async () => {
  const t = setup();
  await tick();
  t.commit('/thread/other');
  t.click.resolve();
  await tick();
  expect(t.page.goBack).not.toHaveBeenCalled();
  t.route.reject(new Error('exact route absent'));
  await expect(t.run).rejects.toThrow('exact route absent');
});
it('does not turn missing route into successful cancellation', async () => {
  const t = setup();
  t.click.resolve();
  t.route.reject(new Error('route timeout'));
  await expect(t.run).rejects.toThrow('route timeout');
  expect(t.page.goBack).not.toHaveBeenCalled();
});
it('retains early failed click without dispatching Back', async () => {
  const t = setup();
  t.click.reject(new Error('click not delivered'));
  await expect(t.run).rejects.toThrow('click not delivered');
  expect(t.page.goBack).not.toHaveBeenCalled();
  expect(t.capture.end).toHaveBeenCalledWith('open-thread');
});
it('retains a late opening click failure after Back instead of treating the route as delivery proof', async () => {
  const t = setup();
  await tick();
  t.commit('/thread/exact');
  await tick();
  t.back.resolve();
  t.click.reject(new Error('late hit-target failure'));
  await expect(t.run).rejects.toThrow('late hit-target failure');
  expect(t.capture.end).toHaveBeenCalledWith('return-channel');
  expect(t.capture.end).toHaveBeenCalledWith('open-thread');
});
it('joins the outstanding click even when Back fails', async () => {
  const t = setup();
  await tick();
  t.commit('/thread/exact');
  await tick();
  t.back.reject(new Error('Back failed'));
  let ended = false;
  t.run
    .finally(() => {
      ended = true;
    })
    .catch(() => {});
  await tick();
  expect(ended).toBe(false);
  t.click.resolve();
  await expect(t.run).rejects.toThrow('Back failed');
  expect(t.capture.end).toHaveBeenCalledWith('open-thread');
});
