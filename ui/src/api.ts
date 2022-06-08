import Urbit from '@urbit/http-api';

export const IS_MOCK =
  import.meta.env.MODE === 'mock' || import.meta.env.MODE === 'staging';
const URL = (import.meta.env.VITE_MOCK_URL ||
  import.meta.env.VITE_VERCEL_URL) as string;

async function setupAPI() {
  if (IS_MOCK) {
    window.ship = '~zod';
    window.our = '~zod';
    window.desk = 'homestead';
    const MockUrbit = (await import('@tloncorp/mock-http-api')).default;
    const mockHandlers = (await import('./mocks/handlers')).default;
    const api = new MockUrbit(mockHandlers, URL || '', '');
    api.ship = window.ship;
    api.verbose = true;
    return api;
  }

  const api = new Urbit('', '', window.desk);
  api.ship = window.ship;
  api.verbose = true;
  return api;
}

export default {
  api: await setupAPI(),
};
