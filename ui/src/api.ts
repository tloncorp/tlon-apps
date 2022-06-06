import Urbit from '@urbit/http-api';
import UrbitMock from '@tloncorp/mock-http-api';
import mockHandlers from './mocks/handlers';

export const IS_MOCK =
  import.meta.env.MODE === 'mock' || import.meta.env.MODE === 'staging';
const URL = (import.meta.env.VITE_MOCK_URL ||
  import.meta.env.VITE_VERCEL_URL) as string;

if (IS_MOCK) {
  window.ship = '~zod';
  window.our = '~zod';
  window.desk = 'homestead';
}

const api = IS_MOCK
  ? new UrbitMock(mockHandlers, URL || '', '')
  : new Urbit('', '', window.desk);
api.ship = window.ship;
api.verbose = true;

export default api;
