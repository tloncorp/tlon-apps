import { logger } from './postActions';
import { Session, getSession, subscribeToSession } from './session';

class SessionActionQueue {
  connected: boolean = true;

  pendingOperations: {
    action: () => Promise<any>;
    resolve: (result: any) => void;
    reject: (err: unknown) => void;
  }[] = [];

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
      this.pendingOperations.unshift(operation);
      if (this.pendingOperations.length === 1) {
        queueMicrotask(() => this.flushPending());
      }
    });
  }

  flushPending() {
    if (this.connected) {
      this.processQueue();
    } else {
      logger.log('not connected, skipping queue processing');
    }
  }

  async processQueue() {
    while (this.pendingOperations.length > 0) {
      const operation = this.pendingOperations.shift();
      if (operation) {
        operation.action().then(operation.resolve).catch(operation.reject);
      }
    }
  }
}

export const sessionActionQueue = new SessionActionQueue();
