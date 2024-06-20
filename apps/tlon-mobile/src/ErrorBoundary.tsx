import crashlytics from '@react-native-firebase/crashlytics';
import { SizableText, View } from '@tloncorp/ui';
import { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  message?: string;
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
