import PostHog from 'posthog-js';

import { getCurrentBreadcrumbs } from '../debug';

let posthogInstance: typeof PostHog | null = null;

export function initializeErrorLogger(apiKey: string) {
  const instance = PostHog.init(apiKey, {
    api_host: 'https://eu.posthog.com',
    autocapture: false,
  });

  if (instance) {
    posthogInstance = instance;
  } else {
    posthogInstance = null;
  }
}

export class ErrorLogger {
  private name: string;
  private baseLogger?: Console;
  private logs: string[] = [];
  private error: Error | null = null;

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

  public async report(error: Error | null) {
    this.error = error;
    const errorToSubmit = this.getErrorToSubmit();
    const crumbs = getCurrentBreadcrumbs();

    if (posthogInstance) {
      posthogInstance.capture('app_error', {
        message: errorToSubmit.message,
        breadcrumbs: crumbs,
        logs: this.logs,
      });
    } else {
      console.warn('PostHog is not initialized');
    }

    if (!__DEV__) {
      console.warn(`New error report: ${errorToSubmit.message}`);
      console.log('Debug Breadcrumbs:');
      crumbs.forEach((crumb) => console.log(crumb));
    }
  }
}
