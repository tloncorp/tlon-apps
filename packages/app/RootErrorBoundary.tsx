import { createDevLogger } from '@tloncorp/shared';
import { themes } from '@tloncorp/ui/config';
import * as SplashScreen from 'expo-splash-screen';
import { Component, ErrorInfo, Fragment, ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

const logger = createDevLogger('root-error-boundary', false);

function hideSplashScreen() {
  if (Platform.OS === 'web') {
    return;
  }

  SplashScreen.hideAsync();
}

interface RootErrorBoundaryProps {
  children: ReactNode;
}

interface RootErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  resetKey: number;
}

function errorDetails(error: Error | null) {
  const details = (error as { details?: unknown } | null)?.details;

  if (
    typeof details !== 'object' ||
    details === null ||
    Array.isArray(details)
  ) {
    return null;
  }

  return details as Record<string, unknown>;
}

export class RootErrorBoundary extends Component<
  RootErrorBoundaryProps,
  RootErrorBoundaryState
> {
  constructor(props: RootErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, resetKey: 0 };
  }

  static getDerivedStateFromError(
    error: Error
  ): Partial<RootErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    hideSplashScreen();

    logger.trackError('Root error boundary triggered', {
      error,
      componentStack: errorInfo.componentStack,
      ...errorDetails(error),
    });
  }

  // Remounts the children so whatever failed (the database gate, most often)
  // runs again from scratch.
  handleRetry = () => {
    this.setState((state) => ({
      hasError: false,
      error: null,
      resetKey: state.resetKey + 1,
    }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.content}>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.message}>
              An error report has been submitted.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={this.handleRetry}
              style={styles.button}
            >
              <Text style={styles.buttonLabel}>Try again</Text>
            </Pressable>
            <Text style={styles.message}>
              If this keeps happening, close and reopen Tlon.
            </Text>
          </View>
        </View>
      );
    }

    return <Fragment key={this.state.resetKey}>{this.props.children}</Fragment>;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: themes.light.secondaryBackground,
  },
  content: {
    maxWidth: 400,
    gap: 12,
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    color: themes.light.primaryText,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: themes.light.secondaryText,
    lineHeight: 21,
    textAlign: 'center',
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: themes.light.background,
    borderWidth: 1,
    borderColor: themes.light.border,
  },
  buttonLabel: {
    fontSize: 14,
    color: themes.light.primaryText,
    textAlign: 'center',
  },
});
