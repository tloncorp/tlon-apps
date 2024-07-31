// import { Platform } from 'react-native';
import * as db from '../db';
import { getCurrentBreadcrumbs } from '../debug';

// RN specific modules are having issues, so we inject them as a dependencies instead. TBD how to handle on web.
type CrashReporter = {
  log: (message: string) => void;
  recordError: (error: Error) => void;
  setUserId: (userId: string) => void;
};

interface DebugPlatformState {
  network: string;
  battery: string;
}

type PlatformState = {
  getDebugInfo: () => Promise<DebugPlatformState | null>;
};

let crashReporterInstance: CrashReporter | null = null;
let platformStateInstance: PlatformState | null = null;

export function initializeCrashReporter<T extends CrashReporter>(
  client: T,
  platformState: PlatformState
) {
  crashReporterInstance = client;
  platformStateInstance = platformState;
}
export const CrashReporter = new Proxy(
  {},
  {
    get: function (target, prop, receiver) {
      if (!crashReporterInstance) {
        throw new Error('Crash reporter not set!');
      }
      return Reflect.get(crashReporterInstance, prop, receiver);
    },
  }
) as CrashReporter;

export const PlatformState = new Proxy(
  {},
  {
    get: function (target, prop, receiver) {
      if (!platformStateInstance) {
        throw new Error('Platform state not set!');
      }
      return Reflect.get(platformStateInstance, prop, receiver);
    },
  }
) as PlatformState;

// try to associate @p with any errors we send
export function setErrorTrackingUserId(userId: string) {
  if (!__DEV__) {
    try {
      CrashReporter.setUserId(userId);
    } catch (e) {
      console.error('Failed to set error tracking user id', e);
    }
  }
}

export class ErrorReporter {
  private name: string;
  private baseLogger?: Console;
  private logs: string[] = [];
  private error: Error | null = null;

  // name identifies the reporter in logs, baseLogger used to echo output in development
  constructor(name: string, baseLogger?: Console) {
    this.name = name;
    this.baseLogger = baseLogger;
    this.error = null;
    this.logs = [];
  }

  public log(message: string) {
    this.logs.push(`(${this.name}): ${message}`);
    this.baseLogger?.log(`(${this.name}): ${message}`);
  }

  private getErrorToSubmit(): Error {
    if (this.error) {
      return this.error;
    }
    return new Error(this.name);
  }

  // data only sent to crashlytics once this method is called
  public async report(error: Error | null) {
    this.error = error;
    const errorToSubmit = this.getErrorToSubmit();
    const crumbs = getCurrentBreadcrumbs();

    let appInfo = null;
    let platformState = null;
    try {
      appInfo = await db.getAppInfoSettings();
      platformState = await PlatformState.getDebugInfo();
    } catch (e) {
      console.error('Failed to get app info or platform state', e);
    }

    if (!__DEV__) {
      if (appInfo) {
        CrashReporter.log(`%groups source: ${appInfo.groupsSyncNode}`);
        CrashReporter.log(`%groups hash: ${appInfo.groupsHash}`);
        if (platformState) {
          CrashReporter.log(`network: ${platformState.network}`);
          CrashReporter.log(`battery: ${platformState.battery}`);
        }
      }

      if (crumbs.length) {
        CrashReporter.log('Debug Breadcrumbs:');
        crumbs.forEach((crumb) => CrashReporter.log(crumb));
      }

      if (this.logs.length) {
        CrashReporter.log(`Reporter logs:`);
        this.logs.forEach((log) => CrashReporter.log(log));
      }

      CrashReporter.recordError(errorToSubmit);
    } else {
      console.warn(`New error report: ${errorToSubmit.message}`);
      console.log('Debug Breadcrumbs:');
      crumbs.forEach((crumb) => console.log(crumb));
    }
  }
}
