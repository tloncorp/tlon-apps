import { ConsoleMessage, Page } from '@playwright/test';

interface RuntimeError {
  message: string;
  stack?: string;
  url?: string;
  lineno?: number;
  colno?: number;
  timestamp?: number;
  type: 'console' | 'error' | 'unhandledrejection';
}

/**
 * Detects runtime errors in Playwright tests that might only appear in production builds.
 * This includes console errors, uncaught exceptions, and unhandled promise rejections.
 *
 * Critical for catching issues like the Expo 52 "Cannot assign to read only property" error
 * that only manifests in production due to different transpilation.
 */
export class RuntimeErrorDetector {
  private errors: RuntimeError[] = [];
  private criticalPatterns = [
    'Cannot assign to read only property',
    'Cannot set property',
    'TypeError: Attempted to assign to readonly property',
    'Module not found',
    'Cannot find module',
    'Failed to resolve module',
    'SyntaxError',
    'Unexpected token',
    'Failed to fetch dynamically imported module',
    'ChunkLoadError',
    'Loading chunk .* failed',
  ];

  // Patterns to ignore - these are known non-critical errors
  private ignoredPatterns = [
    'PostHog was initialized without a token',
    'Urbit client not set',
    'SQLITE_CONSTRAINT',
    'Cannot convert undefined or null to object',
    'react-native-reanimated',
  ];

  /**
   * Attach error detection to a Playwright page.
   * Should be called in test setup/beforeEach.
   */
  async attachToPage(page: Page): Promise<void> {
    // Monitor console errors
    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() === 'error') {
        const text = msg.text();

        // Check if this error should be ignored
        const shouldIgnore = this.ignoredPatterns.some((pattern) =>
          text.toLowerCase().includes(pattern.toLowerCase())
        );

        if (shouldIgnore) {
          return;
        }

        // Check if this is a critical error
        const isCritical = this.criticalPatterns.some((pattern) =>
          text.toLowerCase().includes(pattern.toLowerCase())
        );

        // Only capture critical errors in production mode
        if (isCritical) {
          this.errors.push({
            message: text,
            url: msg.location().url,
            type: 'console',
            timestamp: Date.now(),
          });
        }
      }
    });

    // Catch page errors (uncaught exceptions)
    page.on('pageerror', (error) => {
      const message = error.message;

      // Check if this error should be ignored
      const shouldIgnore = this.ignoredPatterns.some((pattern) =>
        message.toLowerCase().includes(pattern.toLowerCase())
      );

      if (shouldIgnore) {
        return;
      }

      // Check if this is a critical error
      const isCritical = this.criticalPatterns.some((pattern) =>
        message.toLowerCase().includes(pattern.toLowerCase())
      );

      if (isCritical) {
        this.errors.push({
          message: message,
          stack: error.stack,
          type: 'error',
          timestamp: Date.now(),
        });
      }
    });

    // Inject client-side error handlers with filtering logic
    await page.addInitScript(() => {
      // Define patterns inline since we can't pass them as arguments
      const ignoredPatterns = [
        'PostHog was initialized without a token',
        'Urbit client not set',
        'SQLITE_CONSTRAINT',
        'Cannot convert undefined or null to object',
        'react-native-reanimated',
      ];

      const criticalPatterns = [
        'Cannot assign to read only property',
        'Cannot set property',
        'TypeError: Attempted to assign to readonly property',
        'Module not found',
        'Cannot find module',
        'Failed to resolve module',
        'SyntaxError',
        'Unexpected token',
        'Failed to fetch dynamically imported module',
        'ChunkLoadError',
        'Loading chunk .* failed',
      ];

      // Track errors in a global variable - use a type assertion for window
      interface WindowWithErrors extends Window {
        __runtimeErrors?: Array<{
          message: string;
          stack?: string;
          url?: string;
          lineno?: number;
          colno?: number;
          type: string;
          timestamp: number;
        }>;
      }

      (window as WindowWithErrors).__runtimeErrors = [];

      // Helper function to check if error should be captured
      const shouldCaptureError = (message: string) => {
        const lowerMessage = message.toLowerCase();

        // Check if error should be ignored
        const shouldIgnore = ignoredPatterns.some((pattern) =>
          lowerMessage.includes(pattern.toLowerCase())
        );

        if (shouldIgnore) {
          return false;
        }

        // Only capture critical errors
        return criticalPatterns.some((pattern) =>
          lowerMessage.includes(pattern.toLowerCase())
        );
      };

      // Catch window error events
      window.addEventListener('error', (event) => {
        if (shouldCaptureError(event.message)) {
          const errors = (window as WindowWithErrors).__runtimeErrors;
          if (errors) {
            errors.push({
              message: event.message,
              stack: event.error?.stack,
              url: event.filename,
              lineno: event.lineno,
              colno: event.colno,
              type: 'error',
              timestamp: Date.now(),
            });
          }

          // Log to console for visibility
          console.error(
            '[RuntimeErrorDetector] Critical error:',
            event.message
          );
        }
      });

      // Catch unhandled promise rejections
      window.addEventListener('unhandledrejection', (event) => {
        const message =
          event.reason instanceof Error
            ? event.reason.message
            : String(event.reason);

        if (shouldCaptureError(message)) {
          const errors = (window as WindowWithErrors).__runtimeErrors;
          if (errors) {
            errors.push({
              message: `Unhandled Promise Rejection: ${message}`,
              stack: event.reason?.stack,
              type: 'unhandledrejection',
              timestamp: Date.now(),
            });
          }

          // Log to console for visibility
          console.error('[RuntimeErrorDetector] Critical rejection:', message);
        }
      });
    });
  }

  /**
   * Check if any runtime errors were detected.
   * Should be called in test teardown/afterEach.
   */
  async checkForErrors(page: Page): Promise<void> {
    // Retrieve client-side errors
    const clientErrors = await page
      .evaluate(() => {
        interface WindowWithErrors extends Window {
          __runtimeErrors?: Array<{
            message: string;
            stack?: string;
            url?: string;
            lineno?: number;
            colno?: number;
            type: string;
            timestamp: number;
          }>;
        }
        return (window as WindowWithErrors).__runtimeErrors || [];
      })
      .catch(() => []); // Handle if page is closed

    const allErrors = [...this.errors, ...clientErrors];

    if (allErrors.length > 0) {
      // Format error report
      const errorReport = allErrors
        .map((err, index) => {
          return `
Error ${index + 1}:
  Type: ${err.type}
  Message: ${err.message}
  ${err.url ? `URL: ${err.url}` : ''}
  ${err.lineno ? `Line: ${err.lineno}, Column: ${err.colno}` : ''}
  ${err.stack ? `Stack:\n${err.stack}` : ''}
  Timestamp: ${err.timestamp ? new Date(err.timestamp).toISOString() : 'Unknown'}
`;
        })
        .join('\n---\n');

      throw new Error(
        `Runtime errors detected (${allErrors.length} total):\n${errorReport}`
      );
    }
  }

  /**
   * Clear all detected errors.
   * Useful for resetting between test scenarios.
   */
  clear(): void {
    this.errors = [];
  }

  /**
   * Get all detected errors without throwing.
   * Useful for debugging or custom error handling.
   */
  getErrors(): RuntimeError[] {
    return [...this.errors];
  }

  /**
   * Check if any errors match a specific pattern.
   */
  hasErrorMatching(pattern: string | RegExp): boolean {
    const regex =
      typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;
    return this.errors.some((err) => regex.test(err.message));
  }

  /**
   * Add custom critical error patterns to detect.
   */
  addCriticalPattern(pattern: string): void {
    if (!this.criticalPatterns.includes(pattern)) {
      this.criticalPatterns.push(pattern);
    }
  }
}

/**
 * Helper function to wrap a test with error detection.
 */
export async function withErrorDetection(
  page: Page,
  testFn: () => Promise<void>
): Promise<void> {
  const detector = new RuntimeErrorDetector();
  await detector.attachToPage(page);

  try {
    await testFn();
  } finally {
    await detector.checkForErrors(page);
  }
}
