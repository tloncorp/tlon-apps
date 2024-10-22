import { Noun } from '@urbit/nockjs';

/**
 * The configuration for connecting to an Urbit ship.
 */
export interface UrbitParams {
  /** The URL (with protocol and port) of the ship to be accessed. If
   * the airlock is running in a webpage served by the ship, this should just
   * be the empty string.
   */
  url: string;
  /**
   * The "mode" to operate the channel in, determining whether to receive
   * javascript objects or proper Nouns in responses from the channel.
   * Defaults to 'noun'.
   */
  mode?: 'noun' | 'json';
  /**
   * The access code for the ship at that address
   */
  code?: string;
  /**
   * Enables verbose logging
   */
  verbose?: boolean;
  /**
   * The fetch function to use. Defaults to window.fetch. Typically used
   * to pass in locally supported fetch implementation.
   */
  fetch?: typeof fetch;
  /**
   * Called when the connection is established. Probably don't use this
   * as a trigger for refetching data.
   *
   * @param reconnect - true if this is a reconnection
   */
  onOpen?: (reconnect?: boolean) => void;
  /**
   * Called on every attempt to reconnect to the ship. Followed by onOpen
   * or onError depending on whether the connection succeeds.
   */
  onRetry?: () => void;
  /**
   * Called when the connection fails irrecoverably
   */
  onError?: (error: any) => void;
}

/**
 * A path in either string, string-array (with trailing nil), or Noun format
 * @example
 * `'/updates'`
 * `['updates', 0]`
 */
export type Path = string | string[] | Noun;

/**
 * @p including leading sig, rendered as a string
 *
 * @example
 * ```typescript
 * "~sampel-palnet"
 * ```
 */
export type Patp = string;

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
 */
interface PokeBase {
  /**
   * Ship to poke (defaults to the host ship)
   */
  ship?: Patp;
  /**
   */
  app: GallAgent;
  /**
   * Mark of the noun to poke with
   */
  mark: Mark;
  /**
   * result handlers
   */
  onSuccess?: () => void;
}
interface PokeNoun extends PokeBase {
  /**
   * Data to poke with: noun sent as-is or value sent as json
   */
  data: Noun;
  onError?: (e: Noun) => void; //  given a $tang
}
interface PokeJson extends PokeBase {
  /**
   * Data to poke with: noun sent as-is or value sent as json
   */
  data: any;
  onError?: (e: string) => void;
}
export type Poke = PokeNoun | PokeJson;

/**
 * Description of a scry request
 */
export interface Scry {
  /** {@inheritDoc GallAgent} */
  app: GallAgent;
  /** {@inheritDoc Path} */
  path: Path;
  mark?: Mark;
}

/**
 * Description of a thread request
 *
 * @typeParam Action - Typescript type of the data being poked
 */
export interface Thread {
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
  desk: string;
}
export interface NounThread extends Thread {
  /**
   * Data of the input vase
   */
  body: Noun;
}
export interface JsonThread extends Thread {
  /**
   * Data of the input vase
   */
  body: any;
}

/**
 * Subscription event handlers
 *
 */
interface SubscriptionBase {
  /**
   * The ship to subscribe to (defaults to the host ship)
   */
  ship?: Patp;
  /**
   * The agent to subscribe to
   * @example
   * `"graph-store"`
   */
  app: GallAgent;
  /**
   * The path to which to subscribe
   */
  path: Path;
  /**
   * Handle %kick
   */
  onKick?(): void;
}
export interface SubscriptionNoun extends SubscriptionBase {
  /**
   * Handle negative %watch-ack
   */
  //NOTE  error is a $tang
  onNack?(error: Noun): void;
  /**
   * Handle %fact
   */
  onFact?: (mark: Mark, data: Noun) => void;
}
export interface SubscriptionJson extends SubscriptionBase {
  /**
   * Handle negative %watch-ack
   */
  onNack?(error: string): void;
  /**
   * Handle %fact
   */
  onFact?: (mark: Mark, data: any) => void;
}
export type Subscription = SubscriptionJson | SubscriptionNoun;

export type OnceSubscriptionErr = 'onKick' | 'onNack' | 'timeout';

export interface headers {
  Cookie?: string;
  [headerName: string]: string | undefined;
}

export class FatalError extends Error {}

export class ReapError extends Error {}

export class AuthError extends Error {}

export type EyreEvent =
  | EyreEventPokeAck
  | EyreEventWatchAck
  | EyreEventKick
  | EyreEventFact;

type EyreEventPokeAck = {
  tag: 'poke-ack';
  id: number;
  err?: Noun | string;
};
type EyreEventWatchAck = {
  tag: 'watch-ack';
  id: number;
  err?: Noun | string;
};
type EyreEventKick = {
  tag: 'kick';
  id: number;
};
type EyreEventFact = {
  tag: 'fact';
  id: number;
  mark: Mark;
  data: Noun | any;
};
