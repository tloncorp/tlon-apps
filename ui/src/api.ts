import Urbit from '@urbit/http-api';

const api = new Urbit('', '', window.desk);
api.ship = window.ship;

export default api;
