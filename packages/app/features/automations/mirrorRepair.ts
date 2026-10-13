import type { TaskListAttempt } from '../../ui/components/scheduledTaskSections';

/**
 * Getting a bot's task list onto the owner's ship when the ship has none.
 *
 * The ship fills a bot's entry from a watch on the bot, and it opens that
 * watch only when it is told to trust the bot. A ship that was told before
 * it could mirror tasks, or whose watch the bot turned down, has no watch,
 * and a desk before 12.4.0 never asks again, so the list stays missing for
 * good. Telling the ship again opens the watch it lacks; the bot's list then
 * comes over the feed, and a read of the mirror shows it too.
 */
export type MirrorRepairOutcome =
  /** The bot's list is in the mirror. */
  | 'arrived'
  /** The ship was told, and the bot's list has still not come. */
  | 'nothing'
  /** The ship was not told, and its mirror has no list for the bot. */
  | 'notAsked'
  /** The ship could not be told. */
  | 'failed';

// Reads of the mirror at 1, 3, 6, 10 and 15 seconds after the ship is told.
const CHECK_AFTER_MS = [1_000, 2_000, 3_000, 4_000, 5_000];

export function createMirrorRepair({
  ask,
  read,
  arrived,
  pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  checkAfterMs = CHECK_AFTER_MS,
}: {
  /** Tells the owner's ship to watch the bot. */
  ask: (bot: string) => Promise<unknown>;
  /** Reads the mirror into the cache the feed also writes to. */
  read: () => Promise<unknown>;
  /** Whether the cache holds the bot's list, from the feed or a read. */
  arrived: (bot: string) => boolean;
  pause?: (ms: number) => Promise<unknown>;
  /** The wait before each check in a row; after the last, it gives up. */
  checkAfterMs?: readonly number[];
}) {
  const asked = new Set<string>();
  const out = new Map<
    string,
    { tell: boolean; outcome: Promise<MirrorRepairOutcome> }
  >();
  // How the latest try for each bot stands, for the screens showing it. A
  // list that arrived has nothing to say: the list itself is on show.
  const attempts = new Map<string, TaskListAttempt>();
  const listeners = new Set<() => void>();

  function setAttempt(bot: string, attempt: TaskListAttempt | undefined) {
    if (attempt) attempts.set(bot, attempt);
    else attempts.delete(bot);
    for (const listener of listeners) listener();
  }

  async function readQuietly() {
    // A read that fails says nothing about the bot; the next check stands.
    await read().catch(() => {});
  }

  async function look(
    bot: string,
    tell: boolean
  ): Promise<MirrorRepairOutcome> {
    if (!tell) {
      await readQuietly();
      return arrived(bot) ? 'arrived' : 'notAsked';
    }
    asked.add(bot);
    try {
      await ask(bot);
    } catch {
      return 'failed';
    }
    for (const wait of checkAfterMs) {
      if (arrived(bot)) return 'arrived';
      await pause(wait);
      if (arrived(bot)) return 'arrived';
      await readQuietly();
    }
    return arrived(bot) ? 'arrived' : 'nothing';
  }

  /**
   * Looks for the bot's list again, telling the ship first when `tell` is
   * set. A second call while one is out for the same bot joins it, unless
   * this one would tell the ship and that one only reads: telling the ship
   * is not held up, or lost, behind a read.
   */
  function repair(bot: string, { tell }: { tell: boolean }) {
    const running = out.get(bot);
    if (running && (running.tell || !tell)) return running.outcome;
    const started = {
      tell,
      outcome: look(bot, tell).then((outcome) => {
        // A try that was overtaken leaves what is shown to the one in use.
        if (out.get(bot) === started) {
          out.delete(bot);
          setAttempt(bot, outcome === 'arrived' ? undefined : outcome);
        }
        return outcome;
      }),
    };
    out.set(bot, started);
    setAttempt(bot, tell ? 'asking' : 'checking');
    return started.outcome;
  }

  /**
   * The repair nobody asked for, made when a missing list is first seen. It
   * runs once per bot for as long as the app is open, so a bot that has
   * really not started is not told over and over. Once the ship has been
   * told about this bot, by this or by `repair`, it does nothing.
   */
  repair.unprompted = (bot: string) => {
    if (!asked.has(bot)) void repair(bot, { tell: true });
  };

  /** Whether the ship has been told about this bot since the app opened. */
  repair.told = (bot: string) => asked.has(bot);

  /** Where the latest try for this bot has got to, if it has not arrived. */
  repair.attempt = (bot: string) => attempts.get(bot);

  /** Hears every change to what `attempt` answers. */
  repair.subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  return repair;
}

/**
 * The only ship the app may tell the owner's ship to trust: the owner's own
 * bot. A list opened for any other ship is read and never repaired.
 */
export function repairableBot(
  listedBot: string,
  ownBot: string
): string | undefined {
  return ownBot && listedBot === ownBot ? ownBot : undefined;
}
