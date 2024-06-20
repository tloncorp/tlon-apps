import crashlytics from '@react-native-firebase/crashlytics';
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Text, View } from 'react-native';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    crashlytics().recordError(error);
    crashlytics().log(JSON.stringify(errorInfo));
  }

  render() {
    if (this.state.hasError) {
      return (
        <View>
          <Text>Something went wrong. An error report has been submitted.</Text>
        </View>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
