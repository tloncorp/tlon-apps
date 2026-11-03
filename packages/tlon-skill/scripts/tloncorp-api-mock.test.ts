import { expect, test } from 'bun:test';

import { mockedGetGroup, mockedManagementCalls } from './tloncorp-api-mock';

const defaultGetGroup = mockedGetGroup.impl;

// Bun runs a file's tests in order, so the second sees what the first left.
test('a test can leave a shared mock changed', () => {
  mockedGetGroup.impl = async () => {
    throw new Error('left behind');
  };
  mockedManagementCalls.push({ op: 'createGroup', args: [] });
});

test('the next test starts from the defaults', () => {
  expect(mockedGetGroup.impl).toBe(defaultGetGroup);
  expect(mockedManagementCalls).toEqual([]);
});
