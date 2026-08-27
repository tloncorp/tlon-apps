import { expect, test } from 'vitest';

import { runShellFixture } from '../src/node/index';
import { loadFixture } from './fixtures';

/**
 * The end-to-end harness test (session step 8): the full loop over a
 * stubbed bridge host, driving the hand-written poll fixture — the shape
 * every template inherits.
 */

function runPoll(options: { canInvoke?: boolean } = {}) {
  const fixture = loadFixture('poll');
  return runShellFixture({
    window,
    bundleSource: fixture.bundleSource,
    spec: fixture.spec,
    state: fixture.state,
    canInvoke: options.canInvoke,
  });
}

test('init renders the poll from state', () => {
  const run = runPoll();
  expect(run.messages[0]).toMatchObject({ type: 'ready', shellVersion: 1 });
  expect(run.root.textContent).toContain('What should we get for lunch?');
  expect(run.root.textContent).toContain('Pizza');
  expect(run.root.textContent).toContain('Tacos');
  // one existing vote from state.json
  expect(run.root.textContent).toContain('1');
  expect(run.root.querySelectorAll('button')).toHaveLength(2);
  expect(run.errors()).toHaveLength(0);
});

test('state updates re-render the tally', () => {
  const run = runPoll();
  const statBefore = run.root.querySelector('.tsh-stat-value')?.textContent;
  expect(statBefore).toBe('1');

  run.sendState({
    question: 'What should we get for lunch?',
    options: [
      { id: 'pizza', label: 'Pizza', actionId: 'vote-pizza' },
      { id: 'tacos', label: 'Tacos', actionId: 'vote-tacos' },
    ],
    votes: { '~zod': 'pizza', '~ten': 'tacos', '~bus': 'pizza' },
  });

  expect(run.root.querySelector('.tsh-stat-value')?.textContent).toBe('3');
  const badges = Array.from(run.root.querySelectorAll('.tsh-badge')).map(
    (el) => el.textContent
  );
  expect(badges).toEqual(['2', '1']);
});

test('tapping vote emits an invoke with the actionId and rendered revision', () => {
  const run = runPoll();
  expect(run.click('.tsh-list-row button')).toBe(true);
  expect(run.invokes()).toEqual([
    { type: 'invoke', actionId: 'vote-pizza', specRevision: 2 },
  ]);
});

test('permission-off disables the buttons and blocks invokes', () => {
  const run = runPoll({ canInvoke: false });
  const buttons = Array.from(run.root.querySelectorAll('button'));
  expect(buttons.length).toBe(2);
  expect(buttons.every((button) => button.disabled)).toBe(true);
  run.click('.tsh-list-row button');
  expect(run.invokes()).toHaveLength(0);

  // permission arriving live re-renders enabled buttons
  run.setPermission(true);
  const enabled = Array.from(run.root.querySelectorAll('button'));
  expect(enabled.every((button) => !button.disabled)).toBe(true);
  run.click('.tsh-list-row button');
  expect(run.invokes()).toHaveLength(1);
});

test('a throwing bundle renders the broken state and reports over the bridge', () => {
  const fixture = loadFixture('broken');
  const run = runShellFixture({
    window,
    bundleSource: fixture.bundleSource,
    spec: fixture.spec,
    state: fixture.state,
  });
  expect(run.root.querySelector('.tsh-broken')).toBeTruthy();
  expect(run.root.textContent).toContain('This app hit an error');
  expect(run.errors()).toHaveLength(1);
  expect(run.errors()[0]).toMatchObject({
    phase: 'render',
    message: expect.stringContaining('fixture render exploded'),
  });
});
