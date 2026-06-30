import { describe, expect, test } from 'vitest';

import {
  FAKEZOD_ACCESS_CODES,
  allocateRuntimeEndpoints,
} from './ports.js';

describe('runtime endpoint allocation', () => {
  test('preserves fakezod access codes and explicit host/container endpoints', async () => {
    const endpoints = await allocateRuntimeEndpoints({
      fakeModel: 4100,
      zod: 4101,
      ten: 4102,
      mug: 4103,
    });

    expect(endpoints.fakeModel.containerOpenAiBaseUrl).toBe(
      'http://fake-model:4000/v1'
    );
    expect(endpoints.fakeModel.hostOpenAiBaseUrl).toBe(
      'http://127.0.0.1:4100/v1'
    );
    expect(endpoints.ships.zod).toMatchObject({
      ship: '~zod',
      code: FAKEZOD_ACCESS_CODES.zod,
      containerUrl: 'http://ships:8080',
      hostUrl: 'http://127.0.0.1:4101',
    });
    expect(endpoints.ships.ten.code).toBe(FAKEZOD_ACCESS_CODES.ten);
    expect(endpoints.ships.mug.code).toBe(FAKEZOD_ACCESS_CODES.mug);
  });
});
