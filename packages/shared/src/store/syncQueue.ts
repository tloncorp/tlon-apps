import { createDevLogger, logDuration } from '../debug';

const logger = createDevLogger('syncQueue', false);

interface SyncOperation {
  label: string;
  action: () => Promise<any>;
  resolve: (result: any) => void;
  reject: (err: unknown) => void;
}

export class QueueClearedError extends Error {}

class SyncQueue {
  concurrency = 2;
  queue: SyncOperation[];
  isSyncing: boolean;
  activeThreads = 0;

  constructor() {
    this.queue = [];
    this.isSyncing = false;
  }

  add<T>(label: string, action: () => Promise<T>) {
    return new Promise<T>((resolve, reject) => {
      logger.log('enqueue:' + label);
      this.queue.push({ label, action, resolve, reject });
      this.syncNext();
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
    const threadId = this.activeThreads++;
    while (this.queue.length) {
      logger.log('next:thread:' + threadId, 'remaining:' + this.queue.length);
      const { label, action, resolve, reject } = this.queue.shift()!;
      try {
        const result = await logDuration(label, logger, action);
        setTimeout(() => resolve(result), 0);
      } catch (e) {
        logger.log('failed:' + label, threadId, e);
        reject(e);
      }
      logger.log(
        'done:' + label,
        'thread:' + threadId,
        'remaining:' + this.queue.length
      );
    }
    --this.activeThreads;
  }
}

export const syncQueue = new SyncQueue();
