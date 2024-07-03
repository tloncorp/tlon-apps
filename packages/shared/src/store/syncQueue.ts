import { createDevLogger, runIfDev } from '../debug';

const logger = createDevLogger('syncQueue', false);

interface SyncOperation {
  label: string;
  action: () => Promise<any>;
  resolve: (result: any) => void;
  reject: (err: unknown) => void;
  priority: number;
  addedAt: number;
}

// Default sync priority levels
export const SyncPriority = {
  Low: 0,
  Medium: 5,
  High: 10,
};

export class QueueClearedError extends Error {}

class SyncQueue {
  concurrency = 3;
  queue: SyncOperation[];
  isSyncing: boolean;
  activeThreads = 0;

  constructor() {
    this.queue = [];
    this.isSyncing = false;
  }

  highPriority<T>(label: string, action: () => Promise<T>) {
    return this.add(label, SyncPriority.High, action);
  }

  mediumPriority<T>(label: string, action: () => Promise<T>) {
    return this.add(label, SyncPriority.Medium, action);
  }

  lowPriority<T>(label: string, action: () => Promise<T>) {
    return this.add(label, SyncPriority.Low, action);
  }

  add<T>(label: string, priority: number, action: () => Promise<T>) {
    const startTime = Date.now();
    logger.log('pending:' + label, 'priority', priority);

    return new Promise<T>((resolve, reject) => {
      const enqueueOperation = () => {
        const operation = {
          label,
          action,
          resolve,
          reject,
          priority,
          addedAt: startTime,
        };
        this.queue.push(operation);
        this.queue.sort((a, b) => {
          if (a.priority === b.priority) {
            return b.addedAt - a.addedAt;
          }
          return b.priority - a.priority;
        });
        logger.log(
          'enqueued:' + label,
          'priority',
          priority,
          'position',
          runIfDev(() => {
            return this.queue.indexOf(operation) + 1 + '/' + this.queue.length;
          })
        );
        this.syncNext();
      };
      if (priority < SyncPriority.High) {
        delay(priority < SyncPriority.Medium ? 500 : 200).then(
          enqueueOperation
        );
      } else {
        enqueueOperation();
      }
    });
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
      this.queue[0].priority < SyncPriority.Medium &&
      this.activeThreads > 0
    ) {
      return;
    }
    const threadId = this.activeThreads++;
    while (this.queue.length) {
      logger.log('next:thread:' + threadId, 'remaining:' + this.queue.length);
      const loadStartTime = Date.now();
      const { label, action, resolve, reject, addedAt } = this.queue.shift()!;
      try {
        logger.log('loading:' + label, threadId);
        const result = await action();
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

function delay(duration: number) {
  return new Promise((resolve) => setTimeout(resolve, duration));
}

export const syncQueue = new SyncQueue();
