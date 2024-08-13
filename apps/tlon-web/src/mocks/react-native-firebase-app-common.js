// src/mocks/react-native-firebase-app-common.js
export const isBoolean = (value) => typeof value === 'boolean';
export const isError = (value) => value instanceof Error;
export const isObject = (value) => typeof value === 'object' && value !== null;
export const isString = (value) => typeof value === 'string';
// Add any other utility functions used from @react-native-firebase/app/lib/common
