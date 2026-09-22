import { expect, it, vi } from 'vitest';
import { createOnboardingQaClock } from './qa-clock.js';

const DAY = 24 * 60 * 60 * 1000;

it('is available only in the local onboarding sandbox', () => {
  expect(
    createOnboardingQaClock({
      mode: 'production',
      accountUrl: 'http://ships:8080',
      clockFile: '/tmp/clock',
    })
  ).toBeUndefined();
  expect(
    createOnboardingQaClock({
      mode: 'onboarding',
      accountUrl: 'https://example.com',
      clockFile: '/tmp/clock',
    })
  ).toBeUndefined();
});

it('adds a dynamically read offset to real time', () => {
  let offset = DAY;
  const clock = createOnboardingQaClock({
    mode: 'onboarding',
    accountUrl: 'http://ships:8080',
    clockFile: '/tmp/clock',
    baseNow: () => 100,
    readFile: () => String(offset),
  });
  expect(clock?.()).toBe(100 + DAY);
  offset = 2 * DAY;
  expect(clock?.()).toBe(100 + 2 * DAY);
});

it.each(['not-a-number', String(9 * DAY)])(
  'falls back to real time for invalid offset %s',
  (raw) => {
    const error = vi.fn();
    const clock = createOnboardingQaClock({
      mode: 'onboarding',
      accountUrl: 'http://localhost:8080',
      clockFile: '/tmp/clock',
      baseNow: () => 123,
      readFile: () => raw,
      error,
    });
    expect(clock?.()).toBe(123);
    expect(error).toHaveBeenCalledOnce();
  }
);

it('falls back to real time when the offset file is missing', () => {
  const error = vi.fn();
  const clock = createOnboardingQaClock({
    mode: 'onboarding',
    accountUrl: 'http://127.0.0.1:8080',
    clockFile: '/tmp/clock',
    baseNow: () => 456,
    readFile: () => {
      throw new Error('missing');
    },
    error,
  });
  expect(clock?.()).toBe(456);
  expect(error).toHaveBeenCalledOnce();
});
