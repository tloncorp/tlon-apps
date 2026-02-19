import { poke, scry } from './urbit';

const START_PROFILE_COMMAND = '|start %groups %profile';
const SUSPEND_PROFILE_COMMAND = '|suspend %groups %profile';

export async function getPublicProfileEnabled() {
  try {
    return await scry<boolean>({
      app: 'profile',
      path: '/x/bound/json',
    });
  } catch {
    return false;
  }
}

export async function setPublicProfileEnabled(enabled: boolean) {
  if (enabled) {
    try {
      await poke({
        app: 'hood',
        mark: 'helm-hi',
        json: START_PROFILE_COMMAND,
      });
    } catch (error) {
      // Binding can still succeed if %profile is already running.
      console.warn('Failed to start %profile app', error);
    }

    return poke({
      app: 'profile',
      mark: 'json',
      json: { bind: null },
    });
  }

  await poke({
    app: 'profile',
    mark: 'json',
    json: { unbind: null },
  });

  try {
    await poke({
      app: 'hood',
      mark: 'helm-hi',
      json: SUSPEND_PROFILE_COMMAND,
    });
  } catch (error) {
    // Public profile has already been disabled by unbinding.
    console.warn('Failed to suspend %profile app', error);
  }
}
