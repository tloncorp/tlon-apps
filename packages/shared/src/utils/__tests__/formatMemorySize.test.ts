import { expect, it } from 'vitest';

import { formatMemorySize } from '../formatMemorySize';

it('truncates trailing zeros', () => {
  expect(formatMemorySize(1126)).toBe('1.1kb');
  expect(formatMemorySize(1.0)).toBe('1b');
  expect(formatMemorySize(1.1)).toBe('1.1b');
});

it('chooses unit to yield a >=1 result', () => {
  expect(formatMemorySize(1024)).toBe('1kb');
  expect(formatMemorySize(1023)).toBe('1023b');

  expect(formatMemorySize(1024 * 1024)).toBe('1mb');
  expect(formatMemorySize(1024 * 1023.9)).toBe('1023.9kb');
});

// not ideal behavior, leaving a test as documentation
it('rounds up to 1024 of the lower unit when above 1023.9', () => {
  expect(formatMemorySize(1023.95)).toBe('1024b');
  expect(formatMemorySize(1024)).toBe('1kb');
});
