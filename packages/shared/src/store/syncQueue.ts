import { createDevLogger, logDuration } from '../debug';

const logger = createDevLogger('syncQueue', false);

interface SyncOperation {
  label: string;
  action: () => Promise<any>;
  resolve: (result: any) => void;
  reject: (err: unknown) => void;
}

class SyncQueue {
  concurrency = 2;
  queue: SyncOperation[];
  isSyncing: boolean;

  constructor() {
    this.queue = [];
    this.isSyncing = false;
  }

  add<T>(label: string, action: () => Promise<T>) {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ label, action, resolve, reject });
      if (!this.isSyncing) {
        this.start();
      }
    });
  }

  clear() {
    const oldQueue = this.queue;
    this.queue = [];
    oldQueue.forEach((p) => p.reject(new Error('Queue cleared')));
  }

  async sync() {
    while (this.queue.length) {
      const { label, action, resolve, reject } = this.queue.shift()!;
      try {
        const result = await logDuration(label, logger, () => action());
        resolve(result);
      } catch (e) {
        reject(e);
      }
    }
  }

  async start() {
    if (this.isSyncing) return;
    this.isSyncing = true;
    const threads = [];
    for (let i = 0; i < this.concurrency; i++) {
      threads.push(this.sync());
    }
    await Promise.all(threads);
    this.isSyncing = false;
  }
}

export const syncQueue = new SyncQueue();
