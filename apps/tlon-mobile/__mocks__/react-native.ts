import { jest } from '@jest/globals';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const originalModule = jest.requireActual('react-native') as any;

originalModule.NativeModules.SettingsManager = {
  settings: {
    AppleLocale: 'en-US',
    AppleLanguages: ['fr-FR', 'en-US'],
  },
};

originalModule.NativeModules.UrbitModule = {
  clearUrbit: jest.fn(),
  setUrbit: jest.fn(),
};

Object.defineProperty(originalModule, 'Settings', {
  get: jest.fn(() => {
    return { get: jest.fn(), set: jest.fn(), watchKeys: jest.fn() };
  }),
});

module.exports = originalModule;
