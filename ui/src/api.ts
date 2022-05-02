import Urbit from '@urbit/http-api';
import UrbitMock from '@tloncorp/mock-http-api';
import mockHandlers from './state/mockHandlers';

const IS_MOCK = import.meta.env.MODE === 'mock';
const URL = (import.meta.env.VITE_MOCK_URL ||
  import.meta.env.VITE_VERCEL_URL) as string;

const api = IS_MOCK
  ? new UrbitMock(mockHandlers, URL, '')
  : new Urbit('', '', window.desk);
api.ship = window.ship;
api.verbose = true;

export default api;
