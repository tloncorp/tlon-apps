import { Platform } from 'expo-modules-core';
import { ReactNode } from 'react';
import {
  KeyboardAvoidingViewProps,
  KeyboardAvoidingView as RNKeyboardAvoidingView,
} from 'react-native';

export default function KeyboardAvoidingView({
  children,
  ...props
}: { children: ReactNode } & KeyboardAvoidingViewProps) {
  return (
    <RNKeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'position'}
      style={{ flex: 1 }}
      contentContainerStyle={{ flex: 1 }}
      {...props}
    >
      {children}
    </RNKeyboardAvoidingView>
  );
}
