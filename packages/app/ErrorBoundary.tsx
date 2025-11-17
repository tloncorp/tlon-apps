import crashlytics from '@react-native-firebase/crashlytics';
import * as Sentry from '@sentry/react-native';
import { createDevLogger } from '@tloncorp/shared';
import { Component, ErrorInfo, ReactNode } from 'react';

import { SizableText, View } from './ui';

interface ErrorBoundaryProps {
  children: ReactNode;
  message?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

const logger = createDevLogger('error-boundary', false);

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    try {
      // Send to Sentry with React component stack context
      Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack,
          },
        },
      });

      // If was thrown from within AuthenticatedApp, use enhanced error reporting
      // This will also send to Sentry via the logger integration in debug.ts
      logger.crumb(JSON.stringify(errorInfo));
      logger.trackError(error.message, error);
    } catch (e) {
      // Otherwise fallback what we have at hand
      crashlytics().recordError(error);
      crashlytics().log(JSON.stringify(errorInfo));
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <View flex={1} justifyContent="center" alignItems="center">
          <SizableText fontSize="$l" color="$negativeActionText">
            Something went wrong
          </SizableText>
          <SizableText color="$secondaryText">
            {this.props.message ?? 'An error report has been submitted.'}
          </SizableText>
        </View>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
