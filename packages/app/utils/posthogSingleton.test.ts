import { expect, test, vi } from 'vitest';

import { posthogEnabled } from './posthogSingleton';

const { postHogConstructor } = vi.hoisted(() => ({
  postHogConstructor: vi.fn(),
}));

vi.hoisted(() => {
  process.env.NODE_ENV = 'production';
});

vi.mock('posthog-react-native', () => ({
  default: class PostHog {
    constructor(...args: unknown[]) {
      postHogConstructor(...args);
    }
  },
}));

vi.mock('../constants', () => ({
  POST_HOG_API_KEY: '',
  POST_HOG_IN_DEV: false,
}));

test('disables PostHog instead of throwing when a production key is missing', () => {
  expect(posthogEnabled).toBe(false);
  expect(postHogConstructor).toHaveBeenCalledWith('dummy-key', {
    host: 'https://data-bridge-v1.vercel.app/ingest',
    disabled: true,
  });
});
