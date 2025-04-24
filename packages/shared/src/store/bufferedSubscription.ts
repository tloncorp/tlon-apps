import _ from 'lodash';

import { QueryCtx, batchEffects } from '../db/query';
import { createDevLogger } from '../debug';

const logger = createDevLogger('bufferedSubscription', false);

type BufferedSubscription<T> = {
  handler: (update: T[], ctx: QueryCtx) => Promise<void>;
  buffered: T[];
};

const bufferedSubscriptions: BufferedSubscription<any>[] = [];

export function createHandler<T>(
  handler: (update: T, ctx: QueryCtx) => Promise<void>
) {
  return createBatchHandler<T>(async (updates, ctx) => {
    for (const update of updates) {
      try {
        await handler(update, ctx);
      } catch (e) {
        logger.trackError('failed to process buffered event', e);
      }
    }
  });
}

export function createBatchHandler<T>(
  handler: (update: T[], ctx: QueryCtx) => Promise<void>
) {
  const bufferedSubscription: BufferedSubscription<T> = {
    handler,
    buffered: [],
  };
  bufferedSubscriptions.push(bufferedSubscription);
  return (update: T) => {
    bufferedSubscription.buffered.push(update);
    triggerPending();
  };
}

const triggerPending = _.debounce(
  () => {
    batchEffects('pendingSubscriptions', async (ctx) => {
      logger.log('processing pending events');
      for (const bufferedSubscription of bufferedSubscriptions) {
        const { handler, buffered } = bufferedSubscription;
        if (buffered.length > 0) {
          logger.log('processing buffered events', buffered);
          bufferedSubscription.buffered = [];
          try {
            await handler(buffered, ctx);
          } catch (e) {
            logger.trackError('failed to process buffered event', e);
          }
        }
      }
    });
  },
  200,
  {
    trailing: true,
  }
);
