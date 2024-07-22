import { createDevLogger, runIfDev } from '../debug';
import { RetryConfig, withRetry } from '../logic';

const logger = createDevLogger('syncQueue', true);

interface SyncOperation {
  label: string;
  ctx: SyncCtx;
  action: () => Promise<any>;
  resolve: (result: any) => void;
  reject: (err: unknown) => void;
  addedAt: number;
}

// Default sync priority levels
export const SyncPriority = {
  Low: 0,
  Medium: 5,
  High: 10,
};

export type SyncCtx = {
  priority: number;
  retry?: boolean | RetryConfig;
};

export class QueueClearedError extends Error {}

class SyncQueue {
  concurrency = 5;
  queue: SyncOperation[];
  pendingOperations: SyncOperation[] = [];
  isSyncing: boolean;
  activeThreads = 0;

  constructor() {
    this.queue = [];
    this.isSyncing = false;
  }

  highPriority<T>(label: string, action: () => Promise<T>) {
    return this.add(label, { priority: SyncPriority.High }, action);
  }

  mediumPriority<T>(label: string, action: () => Promise<T>) {
    return this.add(label, { priority: SyncPriority.Medium }, action);
  }

  lowPriority<T>(label: string, action: () => Promise<T>) {
    return this.add(label, { priority: SyncPriority.Low }, action);
  }

  add<T>(
    label: string,
    ctx: SyncCtx | undefined | null,
    action: () => Promise<T>
  ) {
    const defaults = { priority: SyncPriority.Medium };
    const ctxWithDefaults = ctx ? { ...defaults, ...ctx } : defaults;
    const startTime = Date.now();
    logger.log('pending:' + label, 'priority', ctxWithDefaults.priority);

    return new Promise<T>((resolve, reject) => {
      const operation = {
        label,
        ctx: ctxWithDefaults,
        action,
        resolve,
        reject,
        addedAt: startTime,
      };
      this.pendingOperations.unshift(operation);
      if (this.pendingOperations.length === 1) {
        queueMicrotask(() => this.flushPending());
      }
    });
  }

  flushPending() {
    const pendingOperations = this.pendingOperations;
    this.pendingOperations = [];
    this.queue.push(...pendingOperations);
    this.queue.sort((a, b) => {
      if (a.ctx.priority === b.ctx.priority) {
        return b.addedAt - a.addedAt;
      }
      return b.ctx.priority - a.ctx.priority;
    });
    pendingOperations
      .sort((a, b) => {
        if (a.ctx.priority === b.ctx.priority) {
          return b.addedAt - a.addedAt;
        }
        return b.ctx.priority - a.ctx.priority;
      })
      .forEach((op) => {
        logger.log(
          'enqueued:' + op.label,
          'priority',
          op.ctx.priority,
          'position',
          runIfDev(() => {
            return this.queue.indexOf(op) + 1 + '/' + this.queue.length;
          })()
        );
      });
    for (let i = 0; i < pendingOperations.length; i++) {
      this.syncNext();
    }
  }

  clear() {
    const oldQueue = this.queue;
    this.queue = [];
    oldQueue.forEach((p) => p.reject(new QueueClearedError('Queue cleared')));
  }

  async syncNext() {
    if (this.activeThreads >= this.concurrency) return;
    if (this.queue.length === 0) return;
    // Try to ensure that low priority tasks don't block the queue
    if (
      this.queue[0].ctx.priority < SyncPriority.Medium &&
      this.activeThreads > this.concurrency - 2
    ) {
      return;
    }
    const threadId = this.activeThreads++;
    while (this.queue.length) {
      logger.log('next:thread:' + threadId, 'remaining:' + this.queue.length);
      const loadStartTime = Date.now();
      const { ctx, label, action, resolve, reject, addedAt } =
        this.queue.shift()!;
      try {
        logger.log('loading:' + label, 'on thread', threadId);
        const baseRetryOptions = {
          delayFirstAttempt: false,
          startingDelay: 1000,
          numOfAttempts: 4,
        };
        const retryOptions = ctx.retry
          ? typeof ctx.retry === 'boolean'
            ? baseRetryOptions
            : { ...baseRetryOptions, ...ctx.retry }
          : null;
        const result = await (retryOptions
          ? withRetry(action, retryOptions)
          : action());
        setTimeout(() => resolve(result), 0);
      } catch (e) {
        logger.log('failed:' + label, threadId, e);
        reject(e);
      }
      logger.log(
        'done:' + label,
        'enqueued:',
        loadStartTime - addedAt,
        'loading:',
        Date.now() - addedAt,
        'total:',
        Date.now() - loadStartTime,
        'thread:' + threadId,
        'remaining:' + this.queue.length
      );
    }
    --this.activeThreads;
  }
}

export const syncQueue = new SyncQueue();
