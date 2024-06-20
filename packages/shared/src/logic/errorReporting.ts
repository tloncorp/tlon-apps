// Crashlytics is RN only, so we inject it as a dependency. TBD how to handle on web.
type CrashReporter = {
  log: (message: string) => void;
  recordError: (error: Error) => void;
  setUserId: (userId: string) => void;
};
let crashReporterInstance: CrashReporter | null = null;
export function setCrashReporter<T extends CrashReporter>(client: T) {
  crashReporterInstance = client;
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

  // data only sent to crashlytics once this method is called
  public report(error: Error) {
    this.error = error;

    if (!__DEV__) {
      this.logs.forEach((log) => CrashReporter.log(log));
      CrashReporter.recordError(error);
    }
  }
}
