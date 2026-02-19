import { poke, scry } from './urbit';

const START_PROFILE_COMMAND = '|start %groups %profile';
const SUSPEND_PROFILE_COMMAND = '|suspend %groups %profile';

export interface PublicProfileWidget {
  desk: string;
  term: string;
}

async function scryProfileBoolean(path: string) {
  return scry<boolean>({
    app: 'profile',
    path,
  });
}

async function scryProfileLayout(path: string) {
  return scry<PublicProfileWidget[]>({
    app: 'profile',
    path,
  });
}

export async function getPublicProfileRunning() {
  try {
    await scryProfileBoolean('/x/bound/json');
    return true;
  } catch {
    try {
      await scryProfileBoolean('/bound/json');
      return true;
    } catch {
      try {
        await scryProfileLayout('/x/layout/json');
        return true;
      } catch {
        try {
          await scryProfileLayout('/layout/json');
          return true;
        } catch {
          return false;
        }
      }
    }
  }
}

export async function getPublicProfileEnabled() {
  try {
    return await scryProfileBoolean('/x/bound/json');
  } catch {
    try {
      return await scryProfileBoolean('/bound/json');
    } catch {
      return false;
    }
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

export async function getPublicProfileLayout() {
  try {
    return await scryProfileLayout('/x/layout/json');
  } catch {
    try {
      return await scryProfileLayout('/layout/json');
    } catch {
      return [];
    }
  }
}

export async function setPublicProfileWidgetEnabled(
  widget: PublicProfileWidget,
  enabled: boolean
) {
  return poke({
    app: 'profile',
    mark: 'json',
    json: enabled
      ? {
          'put-widget': widget,
        }
      : {
          'del-widget': widget,
        },
  });
}
