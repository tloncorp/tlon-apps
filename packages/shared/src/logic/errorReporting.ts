import crashlytics from '@react-native-firebase/crashlytics';

// try to associate @p with any errors we send
export function setErrorTrackingUserId(userId: string) {
  if (!__DEV__) {
    try {
      crashlytics().setUserId(userId);
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
      this.logs.forEach((log) => crashlytics().log(log));
      crashlytics().recordError(error);
    }
  }
}
