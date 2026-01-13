import { createDevLogger } from '@tloncorp/shared';
import { themes } from '@tloncorp/ui/config';
import * as SplashScreen from 'expo-splash-screen';
import { Component, ErrorInfo, ReactNode } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

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
}

export class RootErrorBoundary extends Component<
  RootErrorBoundaryProps,
  RootErrorBoundaryState
> {
  constructor(props: RootErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): RootErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    hideSplashScreen();

    logger.trackError('Root error boundary triggered', {
      error,
      componentStack: errorInfo.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.content}>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.message}>
              An error report has been submitted.
            </Text>
          </View>
        </View>
      );
    }

    return this.props.children;
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
});
