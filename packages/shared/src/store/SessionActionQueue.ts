import { logger } from './postActions';
import { Session, getSession, subscribeToSession } from './session';

class SessionActionQueue {
  connected: boolean = true;

  pendingOperations: {
    action: () => Promise<any>;
    resolve: (result: any) => void;
    reject: (err: unknown) => void;
  }[] = [];

  private currentTaskResult: Promise<unknown> | null = null;

  constructor() {
    this.setConnectedFromSession(getSession());
    subscribeToSession((session) => {
      this.setConnectedFromSession(session);
      this.flushPending();
    });
  }

  setConnectedFromSession(session: Session | null) {
    this.connected =
      session?.channelStatus === 'active' ||
      session?.channelStatus === 'reconnected';
  }

  add<T>(action: () => Promise<T>) {
    return new Promise<T>((resolve, reject) => {
      const operation = {
        action,
        resolve,
        reject,
      };
      this.pendingOperations.push(operation);
      if (this.pendingOperations.length === 1) {
        queueMicrotask(() => this.flushPending());
      }
    });
  }

  flushPending() {
    if (this.currentTaskResult != null) {
      logger.log('queue is already processing, skipping flush');
      return;
    }

    if (this.connected) {
      this.processQueue();
    } else {
      logger.log('not connected, skipping queue processing');
    }
  }

  async processQueue() {
    while (this.pendingOperations.length > 0) {
      if (this.currentTaskResult != null) {
        await this.currentTaskResult;
      }
      const operation = this.pendingOperations.shift();
      if (operation) {
        const promise = operation.action();
        this.currentTaskResult = promise;

        // awaiting here means that we're forced to run tasks serially
        try {
          operation.resolve(await promise);
        } catch (e) {
          operation.reject(e);
        } finally {
          this.currentTaskResult = null;
        }
      }
    }
  }
}

export const sessionActionQueue = new SessionActionQueue();
