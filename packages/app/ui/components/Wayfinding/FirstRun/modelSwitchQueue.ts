export type SwitchOutcome<T> =
  | { superseded: true }
  | { superseded: false; value: T };

/**
 * Runs model switches one at a time, so a slow or retrying switch can't save
 * after a newer choice and put the bot back on the old model. A switch still
 * waiting its turn when a newer one arrives never runs, and a switch that
 * finishes after a newer one arrived reports `superseded`: only the newest
 * choice reaches the bot and the screen.
 */
export function createModelSwitchQueue() {
  let latest = 0;
  let tail: Promise<unknown> = Promise.resolve();
  return function runSwitch<T>(
    task: () => Promise<T>
  ): Promise<SwitchOutcome<T>> {
    const request = ++latest;
    const run = tail.then(async (): Promise<SwitchOutcome<T>> => {
      if (request !== latest) return { superseded: true };
      return { superseded: false, value: await task() };
    });
    // A failed switch must not stop the ones after it.
    tail = run.catch(() => undefined);
    return run.then((outcome) =>
      request === latest ? outcome : { superseded: true }
    );
  };
}
