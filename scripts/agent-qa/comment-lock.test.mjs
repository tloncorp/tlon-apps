import test from 'node:test';
import assert from 'node:assert/strict';
import { withCommentLock } from './comment-lock.mjs';

function fixture() {
  const state = { owner: 'other-worker', calls: [] };
  const gh = (args) => {
    state.calls.push(args);
    if (args.includes('r/git/tags')) return '{"sha":"ours"}';
    if (args.includes('r/git/refs')) {
      if (state.owner) throw new Error('Reference already exists');
      state.owner = 'ours';
      if (state.loseResponse) throw new Error('Connection lost');
      return '{}';
    }
    if (args.some((a) => a.includes('/git/ref/tags/'))) {
      if (state.failReadOnce) {
        state.failReadOnce = false;
        throw new Error('Network unavailable');
      }
      if (!state.owner) throw new Error('HTTP 404');
      return JSON.stringify({ object: { sha: state.owner } });
    }
    if (args.includes('DELETE')) {
      state.owner = null;
      if (state.loseDeleteResponse) {
        state.loseDeleteResponse = false;
        throw new Error('Connection lost');
      }
      return '';
    }
    throw new Error('Unexpected call');
  };
  return {
    state,
    options: { gh, repo: 'unused', pr: 1, head: 'a'.repeat(40), url: 'run' },
  };
}

// Use the real endpoint strings while the fake service models atomic ref creation.
function lockFixture() {
  const f = fixture();
  const gh = f.options.gh;
  f.options.gh = (args) =>
    gh(args.map((a) => a.replace('repos/unused/', 'r/')));
  return f;
}
test('contending publisher waits until the first owner releases, then owns the whole write', () => {
  const { state, options } = lockFixture();
  let waited = false;
  assert.equal(
    withCommentLock(
      options,
      () => {
        assert.equal(waited, true);
        assert.equal(state.owner, 'ours');
        return 'published';
      },
      {
        pause: () => {
          waited = true;
          state.owner = null;
        },
      }
    ),
    'published'
  );
  assert.equal(state.owner, null);
});

test('transient release reads and lost delete responses recover without orphaning the lock', () => {
  for (const failure of ['failReadOnce', 'loseDeleteResponse']) {
    const { state, options } = lockFixture();
    state.owner = null;
    withCommentLock(
      options,
      () => {
        state[failure] = true;
      },
      { pause: () => {} }
    );
    assert.equal(state.owner, null);
  }
});

test('release never deletes another owners ref', () => {
  const { state, options } = lockFixture();
  state.owner = null;
  assert.throws(
    () =>
      withCommentLock(options, () => {
        state.owner = 'replacement';
      }),
    /ownership changed/
  );
  assert.equal(state.owner, 'replacement');
});
test('publication error releases lock, and ambiguous acquisition recovers only its own ref', () => {
  const { state, options } = lockFixture();
  state.owner = null;
  state.loseResponse = true;
  assert.throws(
    () =>
      withCommentLock(options, () => {
        throw new Error('write failed');
      }),
    /write failed/
  );
  assert.equal(state.owner, null);
});
test('a stalled owner is never evicted on timeout', () => {
  const { state, options } = lockFixture();
  assert.throws(
    () =>
      withCommentLock(options, () => assert.fail('must not write'), {
        timeout: 0,
      }),
    /lock is held/
  );
  assert.equal(state.owner, 'other-worker');
  assert.ok(!state.calls.some((args) => args.includes('DELETE')));
});
