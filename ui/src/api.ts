import Urbit from '@urbit/http-api';
import UrbitMock from '@tloncorp/mock-http-api';
import mockHandlers from './state/mockHandlers';

const IS_MOCK = import.meta.env.MODE === 'mock';
const URL = import.meta.env.VITE_SHIP_URL as string;

const api = IS_MOCK
  ? new UrbitMock(URL, '', mockHandlers)
  : new Urbit('', '', window.desk);
api.ship = window.ship;

export default api;
