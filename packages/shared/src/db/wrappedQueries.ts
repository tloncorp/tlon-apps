import { createDevLogger } from '../debug';
import * as queries from './queries';

const logger = createDevLogger('query', true);

export default new Proxy(
  {},
  {
    get: function (target, prop, receiver) {
      const startTime = Date.now();
      const value = Reflect.get(queries, prop, receiver);
      if (typeof value === 'function') {
        return async (...args: any[]) => {
          const result = await value(...args);
          logger.log(
            `${prop.toString()}`,
            args,
            `took ${Date.now() - startTime}ms`
          );
          return result;
        };
      }
    },
  }
) as typeof queries;
