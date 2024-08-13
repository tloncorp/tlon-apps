// src/mocks/react-native-gesture-handler.js
import React from 'react';

// Mock basic components
export const PanGestureHandler = ({ children }) => <>{children}</>;
export const TapGestureHandler = ({ children }) => <>{children}</>;
export const State = {
  UNDETERMINED: 0,
  FAILED: 1,
  BEGAN: 2,
  CANCELLED: 3,
  ACTIVE: 4,
  END: 5,
};

// Mock Pressable component
export const Pressable = ({ children, ...props }) =>
  React.createElement('button', props, children);

// Mock other exports as needed
export const PressableProps = {};
export const gestureHandlerRootHOC = (Component) => Component;
export const TouchableOpacity = ({ children }) => <>{children}</>;
export const Gesture = {
  State,
};
export const GestureDetector = ({ children }) => <>{children}</>;

// Add any other components or functions that your app uses from react-native-gesture-handler
