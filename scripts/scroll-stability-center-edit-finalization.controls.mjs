import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import * as helper from '../apps/tlon-web/e2e/helpers/scrollerCenterEdit.ts';

const never = () => new Promise(() => {});
const editContent = [{ inline: ['actual saved revision '] }];
function fixture({ headersMissing = false, end = -1 } = {}) {
  const page = new EventEmitter();
  const actions = [
    {
      json: {
        channel: {
          nest: 'chat/~zod/test',
          action: {
            post: { edit: { id: '123', essay: { content: editContent } } },
          },
        },
      },
    },
  ];
  let finishedCalls = 0;
  const response = {
    status: () => 204,
    finished: () => {
      finishedCalls++;
      return never();
    },
  };
  const request = {
    method: () => 'PUT',
    url: () => 'http://localhost:3000/~/channel/test',
    postData: () => JSON.stringify(actions),
    response: () => (headersMissing ? never() : Promise.resolve(response)),
    timing: () => ({ startTime: 1100, responseStart: 25, responseEnd: end }),
  };
  const recorder = helper.recordCenterEditRequests(
    page,
    'chat/~zod/test',
    1000
  );
  page.emit('request', request);
  return { page, request, recorder, finishedCalls: () => finishedCalls };
}
const bounded = async (promise) => {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error('unbounded finalization')), 100);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};
test('real response evidence is retained without awaiting a never-finishing 204 body', async () => {
  const f = fixture();
  await bounded(f.recorder.stop(10));
  assert.equal(f.finishedCalls(), 0);
  assert.deepEqual(
    f.recorder.records.map(({ startTime, headersTime, endTime, status }) => ({
      startTime,
      headersTime,
      endTime,
      status,
    })),
    [{ startTime: 100, headersTime: 125, endTime: null, status: 204 }]
  );
  assert.deepEqual(f.recorder.errors, []);
});
test('missing response headers finish within the bound and remain explicit incomplete evidence', async () => {
  const f = fixture({ headersMissing: true });
  await bounded(f.recorder.stop(10));
  assert.equal(f.recorder.records[0].status, 0);
  assert.equal(f.recorder.records[0].headersTime, null);
  assert.ok(f.recorder.errors.some((e) => e.includes('headers')));
  assert.equal(f.page.listenerCount('request'), 0);
});
test('known response end is copied from actual request timing', async () => {
  const f = fixture({ end: 40 });
  await bounded(f.recorder.stop(10));
  assert.equal(f.recorder.records[0].endTime, 140);
  assert.equal(f.recorder.records[0].headersTime, 125);
});
test('frozen raw export and checkpoint precede any transport shutdown', async () => {
  assert.equal(typeof helper.finalizeCenterEditEvidence, 'function');
  const calls = [],
    proof = { errors: [] };
  const collector = (name) => ({
    freeze: async () => calls.push('freeze-' + name),
    stop: async () => {
      calls.push('export-' + name);
      return { samples: [name] };
    },
  });
  await helper.finalizeCenterEditEvidence({
    proof,
    observer: collector('observer'),
    reading: collector('reading'),
    afterCapture: async () => {
      calls.push('durable-read');
      assert.ok(calls.includes('attach-center-edit-frozen-capture'));
    },
    requests: {
      records: [{ status: 0 }],
      errors: [],
      stop: async () => {
        calls.push('transport');
        assert.ok(calls.includes('attach-center-edit-frozen-capture'));
      },
    },
    attach: async (name, value) => {
      calls.push('attach-' + name);
      assert.deepEqual(value.observer.samples, ['observer']);
      assert.deepEqual(value.reading.samples, ['reading']);
    },
  });
  assert.ok(calls.indexOf('export-reading') < calls.indexOf('transport'));
  assert.equal(calls.at(-1), 'attach-center-edit-reading-proof');
});
test('transport shutdown error still leaves the raw proof attached', async () => {
  assert.equal(typeof helper.finalizeCenterEditEvidence, 'function');
  const names = [],
    proof = { errors: [] };
  const collector = {
    freeze: async () => {},
    stop: async () => ({ samples: [1] }),
  };
  await helper.finalizeCenterEditEvidence({
    proof,
    observer: collector,
    reading: collector,
    requests: {
      records: [],
      errors: [],
      stop: async () => {
        throw Error('transport unavailable');
      },
    },
    attach: async (name) => names.push(name),
  });
  assert.deepEqual(names, [
    'center-edit-frozen-capture',
    'center-edit-reading-proof',
  ]);
  assert.ok(proof.errors.some((e) => e.includes('transport unavailable')));
  assert.deepEqual(proof.reading.samples, [1]);
});

test('actual durable GET starts only after the exact response gate resolves', async () => {
  let release,
    time = 10,
    gets = 0;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const page = {
    url: () => 'http://localhost:3000/apps/groups/Home',
    evaluate: async () => time,
    request: {
      get: async () => {
        gets++;
        return { status: () => 200, json: async () => ({ posts: {} }) };
      },
    },
  };
  const pending = helper.readCenterEditWindow(
    page,
    'chat/~zod/test',
    () => gate
  );
  await new Promise(setImmediate);
  assert.equal(
    gets,
    0,
    'optimistic UI readiness is insufficient to start a verification GET'
  );
  time = 50;
  release();
  const read = await pending;
  assert.equal(gets, 1);
  assert.equal(read.startTime, 50);
});
test('failed response gate prevents the actual durable GET', async () => {
  let gets = 0;
  const page = {
    url: () => 'http://localhost:3000/apps/groups/Home',
    evaluate: async () => 10,
    request: {
      get: async () => {
        gets++;
        return { status: () => 200, json: async () => ({ posts: {} }) };
      },
    },
  };
  await assert.rejects(
    helper.readCenterEditWindow(page, 'chat/~zod/test', async () => {
      throw Error('matching headers absent');
    }),
    /matching headers absent/
  );
  assert.equal(gets, 0);
});
test('exact observed edit headers qualify only their own index, ID and essay', async () => {
  const f = fixture();
  assert.equal(typeof f.recorder.waitForHeaders, 'function');
  await f.recorder.waitForHeaders(0, '123', editContent, 10);
  await assert.rejects(
    f.recorder.waitForHeaders(0, '124', editContent, 10),
    /matching edit/
  );
  await assert.rejects(
    f.recorder.waitForHeaders(0, '123', [{ inline: ['wrong'] }], 10),
    /matching edit/
  );
  await assert.rejects(
    f.recorder.waitForHeaders(1, '123', editContent, 10),
    /headers/
  );
  await f.recorder.stop(10);
});
test('absent response never qualifies a durable-read gate', async () => {
  const f = fixture({ headersMissing: true });
  assert.equal(typeof f.recorder.waitForHeaders, 'function');
  await assert.rejects(
    f.recorder.waitForHeaders(0, '123', editContent, 10),
    /headers/
  );
  await f.recorder.stop(10);
});
