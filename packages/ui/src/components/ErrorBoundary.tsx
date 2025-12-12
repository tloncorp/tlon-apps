import { createDevLogger } from '@tloncorp/shared';
import * as React from 'react';
import { View } from 'tamagui';

import { Text } from './TextV2';

const logger = createDevLogger('ErrorBoundary', true);

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logger.trackError('Error boundary triggered', {
      error,
      componentStack: info.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <View flex={1} justifyContent="center" alignItems="center">
          <Text fontSize="$l" color="$negativeActionText">
            Something went wrong
          </Text>
          <Text color="$secondaryText">
            An error report has been submitted.
          </Text>
        </View>
      );
    }

    return this.props.children;
  }
}
