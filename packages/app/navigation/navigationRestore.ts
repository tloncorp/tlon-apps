let restoredSavedPosition = false;
let restoredTopLevelTab: string | null = null;

/**
 * Records that the navigator was seeded with a position saved by a previous
 * run, rather than built from `initialRouteName`, and which top-level tab that
 * position named. Call once, before the navigator mounts.
 */
export function markNavigationRestored(topLevelTab: string | null = null) {
  restoredSavedPosition = true;
  restoredTopLevelTab = topLevelTab;
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

/**
 * The top-level tab the restored position named, or null when it was deeper
 * than the tab navigator or nothing was restored. A tab that is not registered
 * at rehydration time is dropped from the restored state, so this is the only
 * record that the position asked for it.
 */
export function getRestoredTopLevelTab() {
  return restoredTopLevelTab;
}

/**
 * Logout leaves the process running on native, so the next account signs in
 * behind this module state. Without clearing it, that session still looks
 * restored and the cold-start corrections it is owed would stand down.
 */
export function resetNavigationRestored() {
  restoredSavedPosition = false;
  restoredTopLevelTab = null;
}
