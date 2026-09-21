import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectCases } from './select-cases.mjs';

for (const name of [
  'group-swipe-read',
  'group-mark-read',
  'channel-mark-read',
  'dm-swipe-read',
  'home-unread-preview',
]) {
  test(`${name} keeps its unread fixture before Activity clears all`, () => {
    const cases = selectCases(`exchange,activity-filters,${name},reactions`);
    assert.ok(cases.indexOf(name) < cases.indexOf('activity-filters'));
    assert.equal(cases[0], 'exchange');
    assert.equal(cases.at(-1), 'reactions');
    assert.equal(cases.length, 4);
  });
}
for (const name of [
  'dm-block',
  'blocked-group-invite',
  'blocked-group-content',
]) {
  test(`${name} cannot contaminate peer-content cases`, () => {
    assert.throws(
      () => selectCases(`${name},group-changes`),
      /blocking cases separately/
    );
    assert.throws(
      () => selectCases(`reactions,${name}`),
      /blocking cases separately/
    );
    assert.deepEqual(selectCases(name), [name]);
  });
}
test('default batch and focused retries remain usable', () => {
  assert.deepEqual(selectCases(), ['exchange']);
  assert.equal(selectCases('all').length, 11);
  assert.throws(() => selectCases('dm-deny,dm-unblock'), /DM cases separately/);
  assert.throws(() => selectCases('unknown'), /Unknown proof case/);
});
