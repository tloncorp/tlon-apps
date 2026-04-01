import { Noun } from '@urbit/nockjs';

/**
 * An urbit style path, rendered as a Javascript string
 * @example
 * `"/updates"`
 */
export type Path = string;

/**
 * @p including leading sig, rendered as a string
 *
 * @example
 * ```typescript
 * "~sampel-palnet"
 * ```
 *
 */
export type Patp = string;

/**
 * @p not including leading sig, rendered as a string
 *
 * @example
 * ```typescript
 * "sampel-palnet"
 * ```
 *
 */
export type PatpNoSig = string;

/**
 * The name of a clay mark, as a string
 *
 * @example
 * ```typescript
 * "graph-update"
 * ```
 */
export type Mark = string;

/**
 * The name of a gall agent, as a string
 *
 * @example
 *
 * ```typescript
 * "graph-store"
 * ```
 */
export type GallAgent = string;

/**
 * Description of an outgoing poke
 *
 * @typeParam Action - Typescript type of the data being poked
 */
export interface Poke<Action> {
  /**
   * Ship to poke. If left empty, the api lib will populate it with the ship that it is connected to.
   *
   * @remarks
   *
   * This should always be the ship that you are connected to
   *
   */
  ship?: PatpNoSig;
  /**
   */
  app: GallAgent;
  /**
   * Mark of the cage to be poked
   *
   */
  mark: Mark;
  /**
   * Vase of the cage of to be poked, as JSON
   */
  json: Action;
}

export interface NounPoke {
  /**
   * Ship to poke. If left empty, the api lib will populate it with the ship that it is connected to.
   *
   * @remarks
   *
   * This should always be the ship that you are connected to
   *
   */
  ship?: PatpNoSig;
  /**
   */
  app: GallAgent;
  /**
   * Mark of the cage to be poked
   *
   */
  mark: Mark;

  noun: Noun;
  onError?: (e: Noun) => void;
}

/**
 * Description of a scry request
 */
export interface Scry {
  /** {@inheritDoc GallAgent} */
  app: GallAgent;
  /** {@inheritDoc Path} */
  path: Path;
  /** {@inheritDoc Timeout} */
  timeout?: number;
}

/**
 * Description of a thread request
 *
 * @typeParam Action - Typescript type of the data being poked
 */
export interface Thread<Action> {
  /**
   * The mark of the input vase
   */
  inputMark: Mark;
  /**
   * The mark of the output vase
   */
  outputMark: Mark;
  /**
   * Name of the thread
   *
   * @example
   * ```typescript
   * "graph-add-nodes"
   * ```
   */
  threadName: string;
  /**
   * Desk of thread
   */
  desk?: string;
  /**
   * Data of the input vase
   */
  body: Action;

  timeout?: number;
}

export type Action = 'poke' | 'subscribe' | 'ack' | 'unsubscribe' | 'delete';

export interface PokeHandlers {
  onSuccess?: () => void;
  onError?: (e: any) => void;
}

export type PokeInterface<T> = PokeHandlers & Poke<T>;
export type NounPokeInterface = PokeHandlers & NounPoke;

export interface AuthenticationInterface {
  ship: string;
  url: string;
  code: string;
  verbose?: boolean;
}

/**
 * Subscription event handlers
 *
 */
export interface SubscriptionInterface {
  /**
   * Handle negative %watch-ack
   */
  err?(error: any, id: string): void;
  /**
   * Handle %fact
   */
  event?(data: any, mark: string, id: number): void;
  /**
   * Handle %kick
   */
  quit?(data: any): void;
}

export type OnceSubscriptionErr = 'quit' | 'nack' | 'timeout';

export interface SubscriptionRequestInterface extends SubscriptionInterface {
  /**
   * The app to subscribe to
   * @example
   * `"graph-store"`
   */
  app: GallAgent;
  /**
   * The path to which to subscribe
   * @example
   * `"/keys"`
   */
  path: Path;
  /**
   * Whether to resubscribe this exact subscription on quit
   */
  resubOnQuit?: boolean;
  ship?: string;
}

export interface headers {
  'Content-Type': string;
  Cookie?: string;
}

export interface CustomEventHandler {
  (data: any, response: string): void;
}

export interface SSEOptions {
  headers: {
    Cookie?: string;
  };
  withCredentials?: boolean;
}

export interface Ack extends Record<string, any> {
  action: Action;
  'event-id': number;
}

export interface Message extends Record<string, any> {
  action: Action;
  id: number;
}

export class ResumableError extends Error {}

export class FatalError extends Error {}

export class ReapError extends Error {}

export class AuthError extends Error {}

export class SSETimeoutError extends Error {}

export class SSEBadResponseError extends Error {
  public status: number;
  public text?: string;
  constructor(message: string, status: number, text?: string) {
    super(message);
    this.status = status;
    this.text = text;
  }
}
