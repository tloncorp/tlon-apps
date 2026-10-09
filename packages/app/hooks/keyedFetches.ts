/**
 * Keeps one fetch going for each wanted id while the list of wanted ids
 * changes. An id that stays wanted keeps the fetch it has; one that is
 * dropped has its fetch cancelled.
 *
 * A cancelled fetch can still be settling when its id is wanted again, and
 * `fetch` may ignore a call made before it has, so the new fetch starts only
 * once the old one is done.
 */
export function makeKeyedFetches({
  fetch,
  onError,
}: {
  fetch: (id: string, signal: AbortSignal) => Promise<unknown>;
  onError: (id: string, error: unknown) => void;
}) {
  const fetches = new Map<
    string,
    { controller: AbortController; scope: unknown; settled: Promise<void> }
  >();

  /**
   * Sets the ids to fetch. A fetch belongs to the `scope` it was started
   * under, and is started over when the scope changes.
   */
  function want(ids: string[], scope?: unknown) {
    const wanted = new Set(ids);
    for (const [id, running] of fetches) {
      if (!wanted.has(id) || running.scope !== scope) {
        running.controller.abort();
      }
    }
    for (const id of wanted) {
      const previous = fetches.get(id);
      if (previous && !previous.controller.signal.aborted) continue;
      const controller = new AbortController();
      const settled = (previous?.settled ?? Promise.resolve())
        .then(() =>
          controller.signal.aborted ? undefined : fetch(id, controller.signal)
        )
        .catch((error) => {
          if (!controller.signal.aborted) onError(id, error);
        })
        .then(() => {
          if (fetches.get(id)?.controller === controller) fetches.delete(id);
        });
      fetches.set(id, { controller, scope, settled });
    }
  }

  return { want, stop: () => want([]) };
}
