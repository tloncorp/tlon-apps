import { logger } from './postActions/logger';
import { Session, getSession, subscribeToSession } from './session';

type OperationMetadata = Record<string, unknown>;

class SessionActionQueue {
  connected: boolean = true;

  pendingOperations: {
    action: () => Promise<unknown>;
    resolve: (result: unknown) => void;
    reject: (err: unknown) => void;
    metadata?: OperationMetadata;
    enqueuedAt: number;
  }[] = [];

  private isProcessing: boolean = false;
  private loggedOfflineBlock: boolean = false;

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
    if (this.connected) {
      this.loggedOfflineBlock = false;
    }
  }

  add<T>(action: () => Promise<T>, metadata?: OperationMetadata) {
    return new Promise<T>((resolve, reject) => {
      const operation = {
        enqueuedAt: Date.now(),
        action: action as () => Promise<unknown>,
        resolve: (result: unknown) => resolve(result as T),
        reject,
        metadata,
      };
      this.pendingOperations.push(operation);
      if (this.pendingOperations.length === 1) {
        queueMicrotask(() => this.flushPending());
      }
    });
  }

  async flushPending() {
    if (this.isProcessing) {
      logger.log('queue is already processing, skipping flush');
      return;
    }

    try {
      this.isProcessing = true;

      while (this.pendingOperations.length > 0) {
        if (!this.connected) {
          logger.log('not connected, quitting queue processing');
          if (!this.loggedOfflineBlock) {
            this.loggedOfflineBlock = true;
            this.trackQueueEvent('blocked_offline', this.pendingOperations[0]);
          }
          return;
        }

        const operation = this.pendingOperations.shift();
        if (operation) {
          const promise = operation.action();

          // awaiting here means that we're forced to run tasks serially
          try {
            operation.resolve(await promise);
          } catch (e) {
            this.trackQueueEvent('failed', operation, {
              errorType: e instanceof Error ? e.name : typeof e,
              errorMessage: e instanceof Error ? e.message : String(e),
            });
            operation.reject(e);
          }
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private trackQueueEvent(
    phase: string,
    operation?: (typeof this.pendingOperations)[number],
    extra?: OperationMetadata
  ) {
    const session = getSession();
    logger.trackEvent('Session Action Queue Debug', {
      phase,
      queueDepth: this.pendingOperations.length,
      connected: this.connected,
      channelStatus: session?.channelStatus ?? null,
      queuedMs: operation ? Date.now() - operation.enqueuedAt : undefined,
      ...operation?.metadata,
      ...extra,
    });
  }
}

export const sessionActionQueue = new SessionActionQueue();
