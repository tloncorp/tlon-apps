import type UrbitMock from '@tloncorp/mock-http-api';
import Urbit from '@urbit/http-api';

export const IS_MOCK =
  import.meta.env.MODE === 'mock' || import.meta.env.MODE === 'staging';
const URL = (import.meta.env.VITE_MOCK_URL ||
  import.meta.env.VITE_VERCEL_URL) as string;

let mockApi = {} as UrbitMock;
if (IS_MOCK) {
  window.ship = '~zod';
  window.our = '~zod';
  window.desk = 'homestead';
  const MockUrbit = (await import('@tloncorp/mock-http-api')).default;
  const mockHandlers = (await import('./mocks/handlers')).default;
  mockApi = new MockUrbit(mockHandlers, URL || '', '');
  console.log('mockapi', mockApi);
}

const api = IS_MOCK ? mockApi : new Urbit('', '', window.desk);
console.log('api', api);
api.ship = window.ship;
api.verbose = true;

export default api;
