let restoredSavedPosition = false;

/**
 * Records that the navigator was seeded with a position saved by a previous
 * run, rather than built from `initialRouteName`. Call once, before the
 * navigator mounts.
 */
export function markNavigationRestored() {
  restoredSavedPosition = true;
}

/**
 * Whether this launch resumed where the user left off. Cold-start corrections
 * — anything that moves the user on the grounds that they have not chosen yet
 * — must not run when this is true: the saved position *is* the choice, and a
 * restored `ChatList` is indistinguishable from a default one by shape alone.
 */
export function didRestoreNavigation() {
  return restoredSavedPosition;
}

/** Test seam; the flag is otherwise set once per process. */
export function resetNavigationRestoredForTests() {
  restoredSavedPosition = false;
}
