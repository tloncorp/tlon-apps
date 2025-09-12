import { createMockedFunction } from './mock';

function createMockedQuery<T>(cb?: () => T) {
  return Object.assign(createMockedFunction(cb), {
    meta: { tableDependencies: [] },
  });
}

export const getSettings = createMockedQuery();
